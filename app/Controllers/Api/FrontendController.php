<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\HTTP\ResponseInterface;

abstract class FrontendController extends BaseController
{
    protected function rejectCrossOrigin(): ?ResponseInterface
    {
        $origin = $this->request->getHeaderLine('Origin');
        if ($origin === '') {
            return null;
        }

        $originParts = parse_url($origin);
        $baseParts = parse_url(config('App')->baseURL);
        $originPort = $originParts['port'] ?? (($originParts['scheme'] ?? '') === 'https' ? 443 : 80);
        $basePort = $baseParts['port'] ?? (($baseParts['scheme'] ?? '') === 'https' ? 443 : 80);
        if (!is_array($originParts)
            || !is_array($baseParts)
            || strcasecmp((string) ($originParts['host'] ?? ''), (string) ($baseParts['host'] ?? '')) !== 0
            || ($originParts['scheme'] ?? '') !== ($baseParts['scheme'] ?? '')
            || $originPort !== $basePort) {
            return $this->response->setStatusCode(403)->setJSON(['error' => ['message' => 'Origem da requisição não permitida.']]);
        }

        return null;
    }

    /**
     * Lê a sessão e libera o arquivo dela na hora.
     * O CodeIgniter trava o arquivo da sessão durante a requisição inteira; sem isso, as várias
     * chamadas que a mesma aba faz em paralelo (sessão, perfil, produtos, pedidos...) esperam
     * umas pelas outras. Os dados continuam legíveis em $_SESSION depois de liberar.
     * Use só em endpoints que NÃO gravam na sessão (login, cadastro e logout gravam).
     */
    protected function liberarSessao(): void
    {
        session()->close();
    }

    protected function result(array $result): ResponseInterface
    {
        $response = $this->response->setStatusCode($result['status']);
        if ($result['status'] === 204) {
            return $response;
        }
        return $response->setJSON([
            'data'  => $this->rewriteStorageUrls($result['data'] ?? null),
            'error' => $result['error'] ?? null,
            'count' => $result['count'] ?? null,
        ]);
    }

    /**
     * As fotos enviadas são gravadas no banco com o endereço completo de onde o site estava na
     * hora do envio (ex.: https://dona-benta.onrender.com/api/storage/public?...). Aberto em outro
     * endereço (domínio próprio, localhost), essas imagens viram "de outro site" e o CSP
     * (img-src 'self') bloqueia. Aqui o endereço é trocado pelo do site atual, na leitura.
     */
    protected function rewriteStorageUrls(mixed $value): mixed
    {
        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $value[$key] = $this->rewriteStorageUrls($item);
            }
            return $value;
        }
        if (is_string($value) && str_contains($value, 'api/storage/public')) {
            return $this->urlStorageLocal($value);
        }
        return $value;
    }

    private function urlStorageLocal(string $url): string
    {
        $partes = parse_url($url);
        if (!is_array($partes)
            || !preg_match('#(^|/)api/storage/public/?$#', (string) ($partes['path'] ?? ''))
            || empty($partes['query'])) {
            return $url;
        }

        parse_str($partes['query'], $parametros);
        $bucket = $parametros['bucket'] ?? '';
        $caminho = $parametros['path'] ?? '';
        if (!is_string($bucket) || !is_string($caminho) || $bucket === '' || $caminho === '') {
            return $url;
        }

        return base_url('api/storage/public') . '?' . http_build_query(['bucket' => $bucket, 'path' => $caminho], '', '&', PHP_QUERY_RFC3986);
    }
}
