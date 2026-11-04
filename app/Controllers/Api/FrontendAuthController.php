<?php

namespace App\Controllers\Api;

use App\Services\TiDBAuthService;
use CodeIgniter\HTTP\ResponseInterface;

class FrontendAuthController extends FrontendController
{
    private TiDBAuthService $auth;

    public function __construct()
    {
        $this->auth = new TiDBAuthService();
    }

    public function session(): ResponseInterface
    {
        $user = $this->auth->currentUser();
        return $this->response->setJSON([
            'data' => ['user' => $this->rewriteStorageUrls($user)],
            'error' => null,
        ]);
    }

    public function login(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }
        return $this->authResult('login');
    }

    public function signup(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }
        return $this->authResult('signup');
    }

    public function recovery(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }
        return $this->authResult('recovery');
    }

    public function update(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }
        if ($this->auth->currentUser() === null) {
            return $this->response->setStatusCode(401)->setJSON(['data' => null, 'error' => ['message' => 'Autenticação necessária.']]);
        }
        return $this->authResult('update');
    }

    public function logout(): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }
        $this->auth->logout();
        return $this->response->setJSON(['data' => true, 'error' => null]);
    }

    private function authResult(string $action): ResponseInterface
    {
        $payload = $this->request->getJSON(true);
        if (!is_array($payload)) {
            return $this->response->setStatusCode(400)->setJSON(['data' => null, 'error' => ['message' => 'Corpo JSON inválido.']]);
        }
        if ($action === 'recovery') {
            $payload = ['email' => $payload['email'] ?? ''];
        }

        $result = $this->auth->auth($action, $payload);
        $data = $result['data'];
        if (is_array($data)) {
            $data = isset($data['user']) ? ['user' => $data['user']] : null;
        }

        return $this->response->setStatusCode($result['status'])->setJSON([
            'data'  => $this->rewriteStorageUrls($data),
            'error' => $result['error'],
        ]);
    }
}
