<?php

namespace App\Services;

use CodeIgniter\HTTP\Files\UploadedFile;
use Throwable;

class TiDBDataService
{
    private const TABLE_COLUMNS = [
        'perfis' => ['id', 'nome', 'email', 'telefone', 'cep', 'bairro', 'logradouro', 'numero', 'complemento', 'role', 'avatar_url', 'criado_em', 'created_at', 'updated_at'],
        'produtos' => ['id', 'nome', 'categoria', 'preco', 'estoque', 'imagem_url', 'foto_url', 'descricao_curta', 'descricao', 'destaque', 'disponivel', 'ativo', 'criado_em', 'created_at', 'updated_at'],
        'pedidos' => ['id', 'numero_pedido', 'cliente_id', 'usuario_id', 'itens', 'valor_total', 'tipo_entrega', 'endereco_entrega', 'data_agendada', 'horario_agendado', 'data_entrega', 'horario_entrega', 'forma_pagamento', 'observacoes', 'status', 'pago', 'criado_em', 'created_at', 'updated_at'],
        'itens_pedido' => ['id', 'pedido_id', 'produto_id', 'nome', 'nome_produto', 'quantidade', 'preco', 'criado_em', 'created_at'],
    ];

    private const WRITE_COLUMNS = [
        'perfis' => ['nome', 'telefone', 'cep', 'bairro', 'logradouro', 'numero', 'complemento', 'avatar_url'],
        'produtos' => ['id', 'nome', 'categoria', 'preco', 'estoque', 'imagem_url', 'foto_url', 'descricao_curta', 'descricao', 'destaque', 'disponivel', 'ativo'],
        'pedidos' => ['id', 'numero_pedido', 'cliente_id', 'usuario_id', 'itens', 'valor_total', 'tipo_entrega', 'endereco_entrega', 'data_agendada', 'horario_agendado', 'data_entrega', 'horario_entrega', 'forma_pagamento', 'observacoes', 'status', 'pago'],
        'itens_pedido' => ['pedido_id', 'produto_id', 'nome', 'nome_produto', 'quantidade', 'preco'],
    ];

    /**
     * O que visitantes sem login enxergam dos pedidos (horários já ocupados na agenda).
     * Filtros e ordenação também ficam restritos a essas colunas, para que ninguém consiga
     * "testar" endereço, cliente ou valor de pedidos alheios pela contagem de resultados.
     */
    private const PEDIDOS_COLUNAS_PUBLICAS = ['data_agendada', 'horario_agendado', 'status'];

    public function __construct(private ?TiDBAuthService $auth = null)
    {
        $this->auth ??= new TiDBAuthService();
    }

    public function databaseRequest(string $method, string $table, array $query, mixed $payload = null): array
    {
        if (!isset(self::TABLE_COLUMNS[$table])) {
            return $this->failure(404, 'Recurso não encontrado.');
        }

        try {
            $user = $this->auth->currentUser();
            $isAdmin = $this->isAdmin($user);
            if (!$this->isAllowed($method, $table, $user, $isAdmin)) {
                return $this->failure($user === null ? 401 : 403, $user === null ? 'Entre na sua conta para continuar.' : 'Você não tem permissão para esta ação.');
            }

            if ($method === 'GET' || $method === 'HEAD') {
                return $this->read($method, $table, $query, $user, $isAdmin);
            }
            if ($method === 'POST') {
                return $this->insert($table, $payload, $user, $isAdmin);
            }
            if ($method === 'PATCH') {
                return $this->update($table, $query, $payload, $user, $isAdmin);
            }
            if ($method === 'DELETE') {
                return $this->delete($table, $query, $user, $isAdmin);
            }

            return $this->failure(405, 'Método não permitido.');
        } catch (Throwable $exception) {
            log_message('error', 'Falha na consulta ao TiDB ({exception}, tabela {table}).', [
                'exception' => $exception::class,
                'table' => $table,
            ]);
            return $this->failure(503, 'Não foi possível consultar o banco de dados agora.');
        }
    }

    public function upload(string $bucket, string $path, UploadedFile $file, bool $upsert): array
    {
        if (!in_array($bucket, ['produtos', 'fotos-perfil'], true)
            || !$file->isValid()
            || $file->getSize() > 4 * 1024 * 1024
            || $path === ''
            || strlen($path) > 500
            || preg_match('#(^|/)\.\.?(/|$)|[^a-zA-Z0-9._/-]#', $path)) {
            return $this->failure(400, 'Arquivo, tamanho ou destino de upload inválido.');
        }

        $user = $this->auth->currentUser();
        if ($user === null || ($bucket === 'produtos' && !$this->isAdmin($user))) {
            return $this->failure($user === null ? 401 : 403, 'Você não tem permissão para enviar este arquivo.');
        }
        if ($bucket === 'fotos-perfil' && !str_starts_with($path, $user['id'] . '/')) {
            return $this->failure(403, 'Você só pode alterar a própria foto de perfil.');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getTempName());
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return $this->failure(415, 'Envie uma imagem JPG, PNG ou WEBP.');
        }
        $bytes = file_get_contents($file->getTempName());
        if ($bytes === false) {
            return $this->failure(400, 'Não foi possível ler o arquivo enviado.');
        }

        try {
            $db = db_connect();
            $existing = $db->table('arquivos')->where(['bucket' => $bucket, 'path' => $path])->countAllResults();
            if ($existing > 0 && !$upsert) {
                return $this->failure(409, 'Já existe um arquivo com este caminho.');
            }
            $db->table('arquivos')->replace([
                'bucket' => $bucket,
                'path' => $path,
                'mime_type' => $mime,
                'conteudo' => $bytes,
            ]);
            return ['status' => 200, 'data' => ['path' => $path, 'fullPath' => $bucket . '/' . $path], 'error' => null];
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao salvar arquivo no TiDB ({exception}).', ['exception' => $exception::class]);
            return $this->failure(503, 'Não foi possível salvar o arquivo no banco.');
        }
    }

    public function publicObject(string $bucket, string $path): array
    {
        if (!in_array($bucket, ['produtos', 'fotos-perfil'], true)
            || $path === ''
            || strlen($path) > 500
            || preg_match('#(^|/)\.\.?(/|$)|[^a-zA-Z0-9._/-]#', $path)) {
            return $this->failure(404, 'Arquivo não encontrado.');
        }

        try {
            $file = db_connect()->table('arquivos')
                ->select('mime_type, conteudo')
                ->where(['bucket' => $bucket, 'path' => $path])
                ->get()
                ->getRowArray();
            if ($file === null || !in_array($file['mime_type'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
                return $this->failure(404, 'Arquivo não encontrado.');
            }
            return ['status' => 200, 'data' => $file['conteudo'], 'content_type' => $file['mime_type'], 'error' => null];
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao carregar arquivo do TiDB ({exception}).', ['exception' => $exception::class]);
            return $this->failure(503, 'Não foi possível carregar o arquivo agora.');
        }
    }

    private function read(string $method, string $table, array $query, ?array $user, bool $isAdmin): array
    {
        $db = db_connect();
        $count = isset($query['count']);
        $head = $method === 'HEAD';
        $select = $this->parseSelect((string) ($query['select'] ?? '*'), $table);
        $builder = $db->table($table);
        $this->applyAccessScope($builder, $table, $user, $isAdmin, $select);
        if (!$this->applyFilters($builder, $query, $table, $table === 'pedidos' && $user === null ? self::PEDIDOS_COLUNAS_PUBLICAS : null)) {
            return $this->failure(400, 'Filtro de consulta inválido.');
        }

        $total = null;
        if ($count) {
            $total = (clone $builder)->countAllResults();
        }
        if ($head) {
            return ['status' => 200, 'data' => null, 'count' => $total, 'error' => null];
        }

        $columns = $table === 'pedidos' && $user === null
            ? self::PEDIDOS_COLUNAS_PUBLICAS
            : $select['columns'];
        $builder->select($columns === [] ? '*' : implode(',', $columns));
        $this->applyOrderLimit($builder, $query, $table, $table === 'pedidos' && $user === null ? self::PEDIDOS_COLUNAS_PUBLICAS : null);
        $rows = $builder->get()->getResultArray();
        foreach ($rows as &$row) {
            unset($row['senha_hash']);
        }
        unset($row);

        if ($table === 'pedidos' && ($isAdmin || $user !== null)) {
            $this->addRelations($rows, $select['relations']);
        }
        return ['status' => 200, 'data' => $rows, 'count' => $total, 'error' => null];
    }

    private function insert(string $table, mixed $payload, ?array $user, bool $isAdmin): array
    {
        $rows = is_array($payload) && array_is_list($payload) ? $payload : [$payload];
        if ($rows === [] || !is_array($rows[0] ?? null)) {
            return $this->failure(400, 'Dados inválidos.');
        }

        $db = db_connect();
        $data = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                return $this->failure(400, 'Dados inválidos.');
            }
            $clean = $this->filterWritable($table, $row);
            if ($table === 'produtos') {
                $clean['id'] = $clean['id'] ?? bin2hex(random_bytes(16));
            } elseif ($table === 'pedidos') {
                if (!$isAdmin && ($erro = $this->validarNovoPedido($db, $clean, $user)) !== null) {
                    return $erro;
                }
                // Os itens valem só pela tabela itens_pedido (preço do catálogo); nunca pela cópia do navegador.
                unset($clean['itens']);
                $clean['id'] = $clean['id'] ?? bin2hex(random_bytes(16));
                $clean['cliente_id'] = $user['id'];
                $clean['usuario_id'] = $user['id'];
                $clean['status'] = 'aguardando_confirmacao';
                $clean['pago'] = 0;
                // O número é sempre gerado aqui, nunca pelo navegador (que só enxerga os próprios pedidos).
                $clean['numero_pedido'] = $this->gerarNumeroPedido($db);
            } elseif ($table === 'itens_pedido') {
                $productId = trim((string) ($clean['produto_id'] ?? ''));
                $quantity = (int) ($clean['quantidade'] ?? 0);
                if ($productId === '' || $quantity < 1 || $quantity > 100) {
                    return $this->failure(400, 'Produto ou quantidade do pedido inválidos.');
                }
                $product = $db->table('produtos')
                    ->select('id, nome, preco, ativo, disponivel')
                    ->where('id', $productId)
                    ->get()->getRowArray();
                if ($product === null || !(bool) $product['ativo'] || !(bool) $product['disponivel']) {
                    return $this->failure(409, 'Um dos produtos do pedido não está disponível.');
                }
                $clean['nome'] = $product['nome'];
                $clean['nome_produto'] = $product['nome'];
                $clean['preco'] = $product['preco'];
                $clean['quantidade'] = $quantity;
            }
            $data[] = $clean;
        }

        if ($table === 'itens_pedido') {
            foreach ($data as $row) {
                if (!$this->canAccessOrder((string) ($row['pedido_id'] ?? ''), $user, $isAdmin)) {
                    return $this->failure(403, 'Pedido não encontrado ou acesso negado.');
                }
            }
        }

        // Pedidos: se dois checkouts simultâneos sortearem o mesmo número, o índice único recusa
        // a gravação e tentamos de novo com um número novo.
        $tentativas = $table === 'pedidos' ? 3 : 1;
        for ($tentativa = 1; $tentativa <= $tentativas; $tentativa++) {
            try {
                $db->transStart();
                foreach ($data as $row) {
                    if ($table === 'perfis') {
                        $db->table($table)->where('id', $user['id'])->update($row);
                    } else {
                        $db->table($table)->insert($row);
                    }
                }
                $db->transComplete();
                $gravou = $db->transStatus();
            } catch (Throwable $exception) {
                // Com DBDebug ligado o CodeIgniter desfaz a transação e lança a exceção.
                if ($table !== 'pedidos') {
                    throw $exception;
                }
                $gravou = false;
            }
            if ($gravou) {
                break;
            }
            if ($tentativa === $tentativas) {
                return $this->failure(500, 'Não foi possível salvar os dados.');
            }
            foreach ($data as $i => $row) {
                $data[$i]['numero_pedido'] = $this->gerarNumeroPedido($db);
            }
        }

        $inserted = [];
        if ($table === 'pedidos') {
            foreach ($data as $row) {
                $inserted[] = $db->table($table)->where('id', $row['id'])->get()->getRowArray();
            }
        } elseif ($table === 'produtos') {
            foreach ($data as $row) {
                $inserted[] = $db->table($table)->where('id', $row['id'])->get()->getRowArray();
            }
        } else {
            $inserted = $data;
        }
        if ($table === 'itens_pedido') {
            foreach ($data as $row) {
                $total = $db->table('itens_pedido')
                    ->select('SUM(preco * quantidade) AS total', false)
                    ->where('pedido_id', $row['pedido_id'])
                    ->get()->getRowArray();
                $db->table('pedidos')->where('id', $row['pedido_id'])
                    ->update(['valor_total' => (float) ($total['total'] ?? 0)]);
            }
        }
        return ['status' => 201, 'data' => $inserted, 'count' => null, 'error' => null];
    }

    /** Pedidos ainda não pagos que um cliente pode ter ao mesmo tempo (evita lotar a agenda). */
    private const MAX_PEDIDOS_PENDENTES = 3;

    /**
     * Regras para o cliente criar pedido: data válida e não passada, horário livre
     * e um limite de pedidos não pagos em aberto. Retorna a falha, ou null se estiver ok.
     */
    private function validarNovoPedido($db, array $pedido, array $user): ?array
    {
        // O app roda em UTC; "hoje" é o dia em Brasília.
        $hoje = (new \DateTimeImmutable('now', new \DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');

        // Só contam pedidos não pagos ainda por vir: um pedido abandonado deixa de contar quando a data passa.
        $pendentes = $db->table('pedidos')
            ->where('pago', 0)->where('status', 'aguardando_confirmacao')
            ->where('data_agendada >=', $hoje)
            ->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd()
            ->countAllResults();
        if ($pendentes >= self::MAX_PEDIDOS_PENDENTES) {
            return $this->failure(429, 'Você já tem ' . self::MAX_PEDIDOS_PENDENTES . ' pedidos aguardando pagamento. Pague um deles ou fale com a loja pelo WhatsApp para cancelar antes de fazer outro.');
        }

        $data = (string) ($pedido['data_agendada'] ?? '');
        if ($data !== '') {
            $dia = \DateTimeImmutable::createFromFormat('!Y-m-d', $data);
            if ($dia === false || $dia->format('Y-m-d') !== $data) {
                return $this->failure(400, 'Data de agendamento inválida.');
            }
            if ($data < $hoje) {
                return $this->failure(400, 'Escolha uma data a partir de hoje.');
            }
            $horario = (string) ($pedido['horario_agendado'] ?? '');
            if ($horario !== '' && $db->table('pedidos')
                ->where('data_agendada', $data)
                ->where('horario_agendado', $horario)
                ->where('status !=', 'cancelado')
                ->countAllResults() > 0) {
                return $this->failure(409, 'Este horário acabou de ser reservado. Escolha outro.');
            }
        }
        return null;
    }

    /**
     * Número exibido do pedido: sequência global (DB-17) + sufixo curto aleatório (DB-17-A7K2).
     * A sequência conta todos os pedidos da loja (não só os do cliente); o sufixo e a checagem
     * abaixo garantem que o número não se repita mesmo se a contagem voltar (pedido apagado).
     */
    private function gerarNumeroPedido($db): string
    {
        $sequencia = (int) $db->table('pedidos')->countAllResults() + 1;
        $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for ($i = 0; $i < 5; $i++) {
            $sufixo = '';
            for ($c = 0; $c < 4; $c++) {
                $sufixo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
            }
            $numero = sprintf('DB-%02d-%s', $sequencia, $sufixo);
            if ($db->table('pedidos')->where('numero_pedido', $numero)->countAllResults() === 0) {
                return $numero;
            }
        }
        return sprintf('DB-%02d-%s', $sequencia, strtoupper(bin2hex(random_bytes(4))));
    }

    private function update(string $table, array $query, mixed $payload, ?array $user, bool $isAdmin): array
    {
        if (!is_array($payload) || array_is_list($payload)) {
            return $this->failure(400, 'Dados de atualização inválidos.');
        }
        $updates = $this->filterWritable($table, $payload);
        if ($updates === []) {
            return $this->failure(400, 'Nenhum campo permitido para atualização.');
        }
        if ($table === 'perfis' && array_key_exists('avatar_url', $updates)
            && !TiDBAuthService::avatarUrlValida($updates['avatar_url'], (string) ($user['id'] ?? ''))) {
            return $this->failure(400, 'Foto de perfil inválida.');
        }

        $builder = db_connect()->table($table);
        $this->applyAccessScope($builder, $table, $user, $isAdmin, ['columns' => []]);
        if (!$this->applyFilters($builder, $query, $table)) {
            return $this->failure(400, 'Filtro de consulta inválido.');
        }
        $builder->update($updates);
        if ($table === 'perfis' && array_key_exists('avatar_url', $updates) && $user !== null) {
            (new PrivacidadeService())->limparFotosNaoUsadas((string) $user['id']);
        }
        return ['status' => 200, 'data' => [], 'count' => null, 'error' => null];
    }

    private function delete(string $table, array $query, ?array $user, bool $isAdmin): array
    {
        $builder = db_connect()->table($table);
        $this->applyAccessScope($builder, $table, $user, $isAdmin, ['columns' => []]);
        if (!$isAdmin && $table === 'pedidos') {
            $builder->where('pago', 0)->where('status', 'aguardando_confirmacao');
        } elseif (!$isAdmin && $table === 'itens_pedido') {
            $pendingOrders = db_connect()->table('pedidos')->select('id')
                ->where('pago', 0)->where('status', 'aguardando_confirmacao')
                ->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd()
                ->get()->getResultArray();
            $builder->whereIn('pedido_id', array_column($pendingOrders, 'id'));
        }
        if (!$this->applyFilters($builder, $query, $table)) {
            return $this->failure(400, 'Filtro de consulta inválido.');
        }
        $builder->delete();
        $removidos = db_connect()->affectedRows();
        return ['status' => 200, 'data' => ['removidos' => $removidos], 'count' => $removidos, 'error' => null];
    }

    private function applyAccessScope($builder, string $table, ?array $user, bool $isAdmin, array $select): void
    {
        if ($table === 'pedidos') {
            if ($user === null) {
                $builder->select('data_agendada, horario_agendado, status');
                $builder->where('status !=', 'cancelado');
            } elseif (!$isAdmin) {
                $builder->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd();
            }
        } elseif ($table === 'produtos' && !$isAdmin) {
            $builder->where('ativo', 1);
        } elseif ($table === 'perfis') {
            if (!$isAdmin && $user !== null) {
                $builder->where('id', $user['id']);
            }
        } elseif ($table === 'itens_pedido' && !$isAdmin) {
            if ($user === null) {
                $builder->where('id', -1);
            } else {
                $ownedOrders = db_connect()->table('pedidos')->select('id')
                    ->groupStart()->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])->groupEnd()
                    ->get()->getResultArray();
                $builder->whereIn('pedido_id', array_column($ownedOrders, 'id'));
            }
        }
    }

    private function applyFilters($builder, array $query, string $table, ?array $allowed = null): bool
    {
        $allowed ??= self::TABLE_COLUMNS[$table];
        foreach ($query as $key => $expression) {
            if (in_array($key, ['select', 'order', 'limit', 'offset', 'head', 'count'], true)) {
                continue;
            }
            if (!in_array($key, $allowed, true) || !is_string($expression) || !preg_match('/^(eq|neq|in|is|gt|gte|lt|lte)\.(.*)$/', $expression, $matches)) {
                return false;
            }
            [, $operator, $value] = $matches;
            if ($operator === 'in') {
                if (!preg_match('/^\((.*)\)$/', $value, $list)) {
                    return false;
                }
                $values = $list[1] === '' ? [] : explode(',', $list[1]);
                $builder->whereIn($key, $values);
                continue;
            }
            if ($operator === 'is' && strtolower($value) === 'null') {
                $builder->where($key, null);
                continue;
            }
            $sqlOperator = ['eq' => '=', 'neq' => '!=', 'gt' => '>', 'gte' => '>=', 'lt' => '<', 'lte' => '<='][$operator] ?? null;
            if ($sqlOperator === null) {
                return false;
            }
            // Colunas booleanas são TINYINT: no MySQL/TiDB, comparar com o texto 'true' vira 0 e nunca bate.
            $lower = strtolower($value);
            if ($lower === 'true' || $lower === 'false') {
                $value = $lower === 'true' ? 1 : 0;
            }
            $builder->where($key . ' ' . $sqlOperator, $value);
        }
        return true;
    }

    private function applyOrderLimit($builder, array $query, string $table, ?array $allowed = null): void
    {
        $allowed ??= self::TABLE_COLUMNS[$table];
        if (!empty($query['order'])) {
            foreach (explode(',', $query['order']) as $order) {
                [$column, $direction] = array_pad(explode('.', $order, 2), 2, 'asc');
                if (in_array($column, $allowed, true) && in_array(strtolower($direction), ['asc', 'desc'], true)) {
                    $builder->orderBy($column, $direction);
                }
            }
        }
        if (isset($query['limit']) && ctype_digit((string) $query['limit'])) {
            $builder->limit(min(1000, (int) $query['limit']), max(0, (int) ($query['offset'] ?? 0)));
        }
    }

    private function parseSelect(string $select, string $table): array
    {
        $parts = preg_split('/,(?![^()]*\))/', $select) ?: ['*'];
        $columns = [];
        $relations = [];
        foreach ($parts as $part) {
            $part = trim($part);
            if (preg_match('/^(perfis|itens_pedido)\(([^()]*)\)$/', $part, $match)) {
                $relations[$match[1]] = $match[2];
                continue;
            }
            if ($part === '*') {
                $columns = ['*'];
                continue;
            }
            if (in_array($part, self::TABLE_COLUMNS[$table], true)) {
                $columns[] = $part;
            }
        }
        if ($columns === []) {
            $columns = ['*'];
        }
        return ['columns' => $columns, 'relations' => $relations];
    }

    private function addRelations(array &$rows, array $relations): void
    {
        foreach ($rows as &$row) {
            if (isset($relations['perfis'])) {
                $profile = db_connect()->table('perfis')
                    ->select('nome, telefone')
                    ->where('id', $row['cliente_id'] ?? $row['usuario_id'] ?? '')
                    ->get()->getRowArray();
                $row['perfis'] = $profile ?: null;
            }
            if (isset($relations['itens_pedido'])) {
                $row['itens_pedido'] = db_connect()->table('itens_pedido')
                    ->where('pedido_id', $row['id'])
                    ->get()->getResultArray();
            }
        }
        unset($row);
    }

    private function filterWritable(string $table, array $data): array
    {
        return array_intersect_key($data, array_flip(self::WRITE_COLUMNS[$table]));
    }

    private function isAllowed(string $method, string $table, ?array $user, bool $isAdmin): bool
    {
        if (in_array($method, ['GET', 'HEAD'], true)) {
            return $table !== 'perfis' || $user !== null;
        }
        if ($table === 'produtos') {
            return $isAdmin;
        }
        if ($table === 'perfis') {
            return $user !== null && $method === 'PATCH';
        }
        if ($isAdmin) {
            return true;
        }
        if ($user === null) {
            return false;
        }
        return match ($table) {
            'pedidos' => in_array($method, ['POST', 'DELETE'], true),
            'itens_pedido' => in_array($method, ['POST', 'DELETE'], true),
            default => false,
        };
    }

    private function canAccessOrder(string $orderId, ?array $user, bool $isAdmin): bool
    {
        if ($isAdmin) {
            return true;
        }
        if ($user === null) {
            return false;
        }
        return db_connect()->table('pedidos')->where('pago', 0)->where('status', 'aguardando_confirmacao')->groupStart()
            ->where('cliente_id', $user['id'])->orWhere('usuario_id', $user['id'])
            ->groupEnd()->where('id', $orderId)->countAllResults() > 0;
    }

    private function isAdmin(?array $user): bool
    {
        return ($user['user_metadata']['role'] ?? '') === 'admin';
    }

    private function failure(int $status, string $message): array
    {
        return ['status' => $status, 'data' => null, 'error' => ['message' => $message], 'count' => null];
    }
}
