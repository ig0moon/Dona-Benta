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
        return $value;
    }
}
