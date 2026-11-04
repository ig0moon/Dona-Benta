<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class ApiCorsFilter implements FilterInterface
{
    /**
     * Resolve a origem permitida dinamicamente para evitar wildcard '*' com credenciais
     */
    protected function resolveAllowedOrigin(RequestInterface $request): string
    {
        $origin = $request->getHeaderLine('Origin');
        if (empty($origin)) {
            return '*';
        }

        $baseUrl = rtrim(env('app.baseURL', 'http://localhost:8080/'), '/');
        $allowedOrigins = [
            $baseUrl,
            'http://localhost:8080',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001'
        ];

        if (in_array($origin, $allowedOrigins, true)) {
            return $origin;
        }

        // Permite correspondência de host de produção sob HTTPS
        $parsedOriginHost = parse_url($origin, PHP_URL_HOST);
        $parsedBaseHost = parse_url($baseUrl, PHP_URL_HOST);
        if ($parsedOriginHost && $parsedBaseHost && $parsedOriginHost === $parsedBaseHost) {
            return $origin;
        }

        // Caso a origem não seja reconhecida, responde com a URL base oficial da aplicação
        return $baseUrl;
    }

    public function before(RequestInterface $request, $arguments = null)
    {
        // Se for requisição OPTIONS de pré-vôo (preflight)
        if (strtolower($request->getMethod()) === 'options') {
            $origin = $this->resolveAllowedOrigin($request);
            $response = service('response');
            return $response
                ->setHeader('Access-Control-Allow-Origin', $origin)
                ->setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                ->setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
                ->setHeader('Access-Control-Allow-Credentials', 'true')
                ->setHeader('Access-Control-Max-Age', '86400')
                ->setHeader('Vary', 'Origin')
                ->setStatusCode(204);
        }

        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $origin = $this->resolveAllowedOrigin($request);

        $response->setHeader('Access-Control-Allow-Origin', $origin);
        $response->setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $response->setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
        $response->setHeader('Access-Control-Allow-Credentials', 'true');
        $response->setHeader('Vary', 'Origin');

        // Headers OWASP Hardening
        $response->setHeader('X-Content-Type-Options', 'nosniff');
        $response->setHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->setHeader('X-XSS-Protection', '1; mode=block');
        $response->setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        if (trim($request->getUri()->getPath(), '/') !== 'api/storage/public') {
            $response->setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            $response->setHeader('Pragma', 'no-cache');
        }
        $response->setHeader('X-Powered-By', 'Dona-Benta-Secure-Gateway');

        return $response;
    }
}
