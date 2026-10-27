<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Services;

/**
 * Filtro de Limitação de Taxa (Rate Limiting) para rotas da API
 * Proteção contra Ataques de Negação de Serviço (DoS), Carding e Brute Force
 */
class RateLimitFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $throttler = Services::throttler();
        $ip = $request->getIPAddress();
        $path = $request->getUri()->getPath();

        // Limites estritos baseados na criticidade da rota
        $maxRequests = 60;
        $windowSeconds = 60;
        $bucket = 'api_general';

        if (str_contains($path, 'pagamento/cartao')) {
            // Anti-Carding estrito: máximo de 6 tentativas por minuto por IP
            $maxRequests = 6;
            $bucket = 'api_card';
        } elseif (str_contains($path, 'pagamento/pix')) {
            // Máximo de 12 gerações de Pix por minuto por IP
            $maxRequests = 12;
            $bucket = 'api_pix';
        } elseif (str_contains($path, 'pagamento/status')) {
            // Limite de 60 verificações de status por minuto por IP
            $maxRequests = 60;
            $bucket = 'api_status';
        } elseif (str_contains($path, 'simular-aprovacao')) {
            // Limite de 10 simulações por minuto por IP
            $maxRequests = 10;
            $bucket = 'api_simulate';
        }

        $key = 'rl_' . md5($ip . '_' . $bucket);

        // check() retorna false se o limite de requisições por janela foi excedido
        if ($throttler->check($key, $maxRequests, $windowSeconds) === false) {
            $response = Services::response();
            return $response
                ->setStatusCode(429)
                ->setHeader('Retry-After', '60')
                ->setJSON([
                    'erro'     => 'Muitas requisições consecutivas. Limite de segurança excedido. Por favor, aguarde alguns instantes.',
                    'codigo'   => 'RATE_LIMIT_EXCEEDED',
                    'segundos' => 60
                ]);
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $response;
    }
}
