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
        $ip = self::clientIp($request);
        $path = $request->getUri()->getPath();

        // Limites estritos baseados na criticidade da rota
        $maxRequests = 60;
        $windowSeconds = 60;
        $bucket = 'api_general';

        if (str_contains($path, 'pagamento/cartao')) {
            // Anti-Carding estrito: máximo de 6 tentativas por minuto por IP
            $maxRequests = 6;
            $bucket = 'api_card';
        } elseif (str_contains($path, 'auth/login')) {
            $maxRequests = 10;
            $bucket = 'api_auth_login';
        } elseif (str_contains($path, 'auth/signup') || str_contains($path, 'auth/recovery')) {
            $maxRequests = 5;
            $bucket = 'api_auth_signup';
        } elseif (str_contains($path, 'pagamento/pix')) {
            // Máximo de 12 gerações de Pix por minuto por IP
            $maxRequests = 12;
            $bucket = 'api_pix';
        } elseif (str_contains($path, 'pagamento/status')) {
            // Limite de 60 verificações de status por minuto por IP
            $maxRequests = 60;
            $bucket = 'api_status';
        } elseif (str_contains($path, 'conta/excluir')) {
            // Pede a senha: mesmo limite do login contra tentativas em série
            $maxRequests = 5;
            $bucket = 'api_conta_excluir';
        } elseif (str_contains($path, 'conta/meus-dados')) {
            $maxRequests = 5;
            $bucket = 'api_conta_dados';
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

    /**
     * Atrás do proxy do Render, getIPAddress() devolve o IP do proxy, e todos os
     * visitantes dividiriam o mesmo limite. Com TRUST_TRUE_CLIENT_IP=true usamos o
     * cabeçalho True-Client-IP (definido pela borda e não forjável pelo visitante).
     * Fora do Render deixe a variável desligada.
     */
    public static function clientIp(RequestInterface $request): string
    {
        if (filter_var(env('TRUST_TRUE_CLIENT_IP', false), FILTER_VALIDATE_BOOLEAN)) {
            $candidate = trim($request->getHeaderLine('True-Client-IP'));
            if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_IP)) {
                return $candidate;
            }
        }

        return $request->getIPAddress();
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        return $response;
    }
}
