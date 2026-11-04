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

    protected function rewriteStorageUrls(mixed $value): mixed
    {
        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $value[$key] = $this->rewriteStorageUrls($item);
            }
            return $value;
        }
        if (!is_string($value)) {
            return $value;
        }

        $url = parse_url($value);
        $supabaseHost = parse_url((string) env('SUPABASE_URL', ''), PHP_URL_HOST);
        $marker = '/storage/v1/object/public/';
        if (!is_array($url)
            || !is_string($supabaseHost)
            || strcasecmp((string) ($url['host'] ?? ''), $supabaseHost) !== 0
            || !str_starts_with($url['path'] ?? '', $marker)) {
            return $value;
        }

        $object = explode('/', substr($url['path'], strlen($marker)), 2);
        if (count($object) !== 2) {
            return $value;
        }

        return base_url('api/storage/public') . '?' . http_build_query([
            'bucket' => rawurldecode($object[0]),
            'path'   => rawurldecode($object[1]),
        ], '', '&', PHP_QUERY_RFC3986);
    }
}
