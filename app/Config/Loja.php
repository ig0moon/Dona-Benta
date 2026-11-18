<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Identificação da loja exibida no rodapé, na Política de Privacidade e nos Termos.
 *
 * O Decreto 7.962/2013 (comércio eletrônico) exige que o site mostre, em local de destaque,
 * nome empresarial, CNPJ, endereço físico e eletrônico. Preencha no ambiente (Render ou .env):
 *   LOJA_RAZAO_SOCIAL, LOJA_CNPJ, LOJA_ENDERECO, LOJA_EMAIL, LOJA_WHATSAPP
 * Enquanto LOJA_CNPJ / LOJA_RAZAO_SOCIAL estiverem vazios, essas linhas não aparecem.
 */
class Loja extends BaseConfig
{
    public string $nomeFantasia = 'Dona Benta Confeitaria e Padaria';
    public string $razaoSocial = '';
    public string $cnpj = '';
    public string $endereco = 'Rua Padre Anacleto, 1168 - Nova Rússia, Ponta Grossa - PR';
    public string $email = 'contato@donabenta.com.br';
    public string $whatsapp = '(42) 99982-3994';

    public function __construct()
    {
        parent::__construct();

        $this->razaoSocial = trim((string) env('LOJA_RAZAO_SOCIAL', $this->razaoSocial));
        $this->cnpj = trim((string) env('LOJA_CNPJ', $this->cnpj));
        $this->endereco = trim((string) env('LOJA_ENDERECO', $this->endereco));
        $this->email = trim((string) env('LOJA_EMAIL', $this->email));
        $this->whatsapp = trim((string) env('LOJA_WHATSAPP', $this->whatsapp));
    }

    /** Dados seguros para expor ao navegador (rodapé). */
    public function publico(): array
    {
        return [
            'nomeFantasia' => $this->nomeFantasia,
            'razaoSocial'  => $this->razaoSocial,
            'cnpj'         => $this->cnpj,
            'endereco'     => $this->endereco,
            'email'        => $this->email,
            'whatsapp'     => $this->whatsapp,
        ];
    }
}
