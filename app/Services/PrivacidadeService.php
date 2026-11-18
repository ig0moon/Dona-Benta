<?php

namespace App\Services;

use Throwable;

/**
 * Direitos do titular (LGPD, art. 18) e obrigações de guarda de registros.
 *
 * - exportarDados(): cópia dos dados do cliente (acesso e portabilidade).
 * - excluirConta(): eliminação da conta. Pedidos já pagos ou concluídos continuam guardados
 *   (sem endereço e observações) porque a loja precisa deles para obrigações fiscais e de
 *   defesa do consumidor (LGPD, art. 16, I); o restante é apagado.
 * - limparFotosNaoUsadas(): apaga do banco as fotos de perfil que não estão mais em uso.
 * - registrarAcesso(): registro de acesso exigido pelo Marco Civil da Internet (art. 15),
 *   guardado por 6 meses.
 */
class PrivacidadeService
{
    /** Marco Civil da Internet, art. 15: registros de acesso guardados por 6 meses. */
    private const MESES_REGISTRO_ACESSO = 6;

    /** Status em que o pedido ainda está em andamento e a conta não pode ser excluída. */
    private const STATUS_EM_ANDAMENTO = ['confirmado', 'em_preparo', 'pronto'];

    public function exportarDados(array $user): array
    {
        $db = db_connect();
        $perfil = $db->table('perfis')
            ->select('id, nome, email, telefone, cep, bairro, logradouro, numero, complemento, avatar_url, criado_em')
            ->where('id', $user['id'])
            ->get()->getRowArray();

        $pedidos = $db->table('pedidos')
            ->select('id, numero_pedido, valor_total, tipo_entrega, endereco_entrega, data_agendada, horario_agendado, forma_pagamento, observacoes, status, pago, criado_em')
            ->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd()
            ->orderBy('criado_em', 'desc')
            ->get()->getResultArray();

        foreach ($pedidos as &$pedido) {
            $pedido['itens'] = $db->table('itens_pedido')
                ->select('nome_produto, nome, quantidade, preco')
                ->where('pedido_id', $pedido['id'])
                ->get()->getResultArray();
        }
        unset($pedido);

        return [
            'gerado_em'   => date('c'),
            'controlador' => 'Dona Benta Confeitaria e Padaria',
            'observacao'  => 'Cópia dos dados pessoais guardados na sua conta (LGPD, art. 18). '
                . 'A senha não é incluída: ela é guardada apenas de forma criptografada e não pode ser lida nem por nós.',
            'perfil'      => $perfil,
            'pedidos'     => $pedidos,
        ];
    }

    /**
     * @return array{status:int, erro?:string}
     */
    public function excluirConta(array $user, string $senha): array
    {
        if (($user['user_metadata']['role'] ?? '') === 'admin') {
            return ['status' => 403, 'erro' => 'Contas de administrador não podem ser excluídas pelo site. Remova o acesso de administrador antes.'];
        }

        $db = db_connect();
        $perfil = $db->table('perfis')->select('id, senha_hash')->where('id', $user['id'])->get()->getRowArray();
        if ($perfil === null || empty($perfil['senha_hash']) || !password_verify($senha, $perfil['senha_hash'])) {
            return ['status' => 401, 'erro' => 'Senha incorreta.'];
        }

        $emAndamento = $db->table('pedidos')
            ->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd()
            ->groupStart()
                ->whereIn('status', self::STATUS_EM_ANDAMENTO)
                ->orGroupStart()->where('pago', 1)->where('status', 'aguardando_confirmacao')->groupEnd()
            ->groupEnd()
            ->countAllResults();
        if ($emAndamento > 0) {
            return ['status' => 409, 'erro' => 'Você tem pedidos em andamento. Aguarde a entrega (ou o cancelamento) para excluir a conta, ou fale com a gente pelo WhatsApp.'];
        }

        $db->transStart();
        // Pedidos não pagos e ainda aguardando: não há obrigação de guarda, são apagados.
        $pendentes = $db->table('pedidos')->select('id')
            ->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd()
            ->where('pago', 0)->where('status', 'aguardando_confirmacao')
            ->get()->getResultArray();
        $idsPendentes = array_column($pendentes, 'id');
        if ($idsPendentes !== []) {
            $db->table('itens_pedido')->whereIn('pedido_id', $idsPendentes)->delete();
            $db->table('pedidos')->whereIn('id', $idsPendentes)->delete();
        }
        // Demais pedidos: ficam para fins fiscais, sem endereço e observações.
        $db->table('pedidos')
            ->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd()
            ->update(['endereco_entrega' => null, 'observacoes' => null]);
        $db->table('arquivos')->where('bucket', 'fotos-perfil')->like('path', $user['id'] . '/', 'after')->delete();
        $db->table('perfis')->where('id', $user['id'])->delete();
        $db->transComplete();

        if (!$db->transStatus()) {
            return ['status' => 500, 'erro' => 'Não foi possível excluir a conta agora. Tente de novo em instantes.'];
        }
        return ['status' => 200];
    }

    /**
     * Apaga as fotos de perfil do usuário que não são a foto atual (trocadas ou removidas).
     * Sem isso, a foto "removida" continuava salva e acessível pelo link antigo.
     */
    public function limparFotosNaoUsadas(string $userId): void
    {
        if ($userId === '') {
            return;
        }
        try {
            $db = db_connect();
            $perfil = $db->table('perfis')->select('avatar_url')->where('id', $userId)->get()->getRowArray();
            $atual = $this->caminhoDaFoto((string) ($perfil['avatar_url'] ?? ''));

            $builder = $db->table('arquivos')->where('bucket', 'fotos-perfil')->like('path', $userId . '/', 'after');
            if ($atual !== null) {
                $builder->where('path !=', $atual);
            }
            $builder->delete();
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao limpar fotos de perfil antigas ({exception}).', ['exception' => $exception::class]);
        }
    }

    /**
     * Grava o registro de acesso (data, hora e IP) de um login ou cadastro.
     * Falha aqui nunca impede o login: só fica no log.
     */
    public function registrarAcesso(string $userId, string $evento, string $ip): void
    {
        try {
            $db = db_connect();
            $db->table('registros_acesso')->insert([
                'perfil_id' => $userId,
                'evento'    => substr($evento, 0, 30),
                'ip'        => substr($ip, 0, 45),
            ]);
            // Limpeza ocasional do que passou do prazo de guarda.
            if (random_int(1, 50) === 1) {
                $db->table('registros_acesso')
                    ->where('criado_em <', date('Y-m-d H:i:s', strtotime('-' . self::MESES_REGISTRO_ACESSO . ' months')))
                    ->delete();
            }
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao gravar registro de acesso ({exception}). A tabela registros_acesso foi criada?', ['exception' => $exception::class]);
        }
    }

    private function caminhoDaFoto(string $url): ?string
    {
        if ($url === '') {
            return null;
        }
        $query = parse_url($url, PHP_URL_QUERY);
        if (!is_string($query)) {
            return null;
        }
        parse_str($query, $parametros);
        return ($parametros['bucket'] ?? '') === 'fotos-perfil' && is_string($parametros['path'] ?? null)
            ? $parametros['path']
            : null;
    }
}
