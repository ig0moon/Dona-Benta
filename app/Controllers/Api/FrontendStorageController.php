<?php

namespace App\Controllers\Api;

use App\Services\SupabaseProxyService;
use CodeIgniter\HTTP\ResponseInterface;

class FrontendStorageController extends FrontendController
{
    private SupabaseProxyService $supabase;

    public function __construct()
    {
        $this->supabase = new SupabaseProxyService();
    }

    public function upload(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }

        $file = $this->request->getFile('file');
        $bucket = (string) $this->request->getPost('bucket');
        $path = (string) $this->request->getPost('path');
        if ($file === null || $file->getSize() > 8 * 1024 * 1024) {
            return $this->response->setStatusCode(400)->setJSON(['data' => null, 'error' => ['message' => 'Arquivo obrigatório.']]);
        }

        return $this->result($this->supabase->upload(
            $bucket,
            $path,
            $file,
            $this->request->getPost('upsert') === 'true',
        ));
    }

    public function publicObject(): ResponseInterface
    {
        $result = $this->supabase->publicObject(
            (string) $this->request->getGet('bucket'),
            (string) $this->request->getGet('path'),
        );
        if ($result['status'] < 200 || $result['status'] >= 300) {
            return $this->response->setStatusCode($result['status']);
        }

        return $this->response
            ->setHeader('Content-Type', $result['content_type'] ?: 'application/octet-stream')
            ->setHeader('Cache-Control', 'public, max-age=3600')
            ->setHeader('X-Content-Type-Options', 'nosniff')
            ->setBody($result['data']);
    }
}
