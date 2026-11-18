<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Identificação da loja exibida no rodapé, na Política de Privacidade e nos Termos.
 *
 * O Decreto 7.962/2013 (comércio eletrônico) exige que o site mostre, em local de destaque,
 * nome empresarial, CNPJ, endereço físico e eletrônico. Preencha no ambiente (Render ou .env):
 *   LOJA_RAZAO_SOCIAL, LOJA_CNPJ, LOJA_ENDERECO, LOJA_EMAIL, LOJA_WHATSAPP
 * Enquanto LOJA_CNPJ / LOJA_RAZAO_SOCIAL / LOJA_EMAIL estiverem vazios, essas linhas não aparecem.
 *
 * ATENÇÃO: não use @donabenta.com.br. Esse domínio é da J. Macêdo (marca de farinha), não da loja;
 * e-mails para ele iriam para outra empresa.
 */
class Loja extends BaseConfig
{
    public string $nomeFantasia = 'Panificadora Dona Benta';
    public string $razaoSocial = '';
    public string $cnpj = '';
    public string $endereco = 'Rua Padre Anacleto, 1168 - Nova Rússia, Ponta Grossa - PR';
    public string $email = '';
    public string $whatsapp = '(42) 99982-3994';
    /** Frete fixo das entregas, em reais. Defina LOJA_FRETE no ambiente (ex.: 10,00). 0 = entrega sem frete. */
    public float $frete = 0.0;

    public function __construct()
    {
        parent::__construct();

        $this->razaoSocial = trim((string) env('LOJA_RAZAO_SOCIAL', $this->razaoSocial));
        $this->cnpj = trim((string) env('LOJA_CNPJ', $this->cnpj));
        $this->endereco = trim((string) env('LOJA_ENDERECO', $this->endereco));
        $this->email = trim((string) env('LOJA_EMAIL', $this->email));
        $this->whatsapp = trim((string) env('LOJA_WHATSAPP', $this->whatsapp));
        $frete = str_replace(',', '.', trim((string) env('LOJA_FRETE', '')));
        $this->frete = is_numeric($frete) && (float) $frete >= 0 ? round((float) $frete, 2) : 0.0;
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
            'frete'        => $this->frete,
        ];
    }
}
