<?php

namespace App\Services;

use Throwable;

class TiDBAuthService
{
    public function currentUser(): ?array
    {
        $userId = session()->get('tidb_user_id');
        if (!is_string($userId) || $userId === '') {
            return null;
        }

        try {
            $profile = db_connect()->table('perfis')
                ->select('id, nome, email, telefone, cep, bairro, logradouro, numero, complemento, role, avatar_url')
                ->where('id', $userId)
                ->get()
                ->getRowArray();

            if ($profile === null) {
                session()->remove('tidb_user_id');
                return null;
            }

            return $this->userFromProfile($profile);
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao carregar usuário do TiDB ({exception}).', ['exception' => $exception::class]);
            return null;
        }
    }

    public function auth(string $action, array $payload = []): array
    {
        if ($action === 'recovery') {
            return $this->failure(501, 'A recuperação de senha por e-mail ainda não está configurada.');
        }

        if ($action === 'login') {
            return $this->login($payload);
        }
        if ($action === 'signup') {
            return $this->signup($payload);
        }
        if ($action === 'update') {
            return $this->updateProfile($payload);
        }

        return $this->failure(400, 'Ação de autenticação inválida.');
    }

    public function logout(): void
    {
        session()->remove('tidb_user_id');
        session()->regenerate(true);
    }

    private function login(array $payload): array
    {
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            return $this->failure(400, 'Informe um e-mail e uma senha válidos.');
        }

        try {
            $profile = db_connect()->table('perfis')
                ->where('email', $email)
                ->get()
                ->getRowArray();

            if ($profile === null || empty($profile['senha_hash']) || !password_verify($password, $profile['senha_hash'])) {
                return $this->failure(401, 'E-mail ou senha incorretos.');
            }

            session()->regenerate(true);
            session()->set('tidb_user_id', (string) $profile['id']);
            return ['status' => 200, 'data' => ['user' => $this->userFromProfile($profile)], 'error' => null];
        } catch (Throwable $exception) {
            log_message('error', 'Falha no login pelo TiDB ({exception}).', ['exception' => $exception::class]);
            return $this->failure(503, 'Não foi possível acessar a conta agora.');
        }
    }

    private function signup(array $payload): array
    {
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $password = (string) ($payload['password'] ?? '');
        $metadata = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $name = trim((string) ($metadata['nome'] ?? ''));
        $phone = trim((string) ($metadata['telefone'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6 || $name === '') {
            return $this->failure(400, 'Informe nome, e-mail válido e senha com pelo menos 6 caracteres.');
        }

        try {
            $id = bin2hex(random_bytes(16));
            $db = db_connect();
            $db->table('perfis')->insert([
                'id'          => $id,
                'nome'        => $name,
                'email'       => $email,
                'telefone'    => $phone,
                'role'        => 'cliente',
                'senha_hash'  => password_hash($password, PASSWORD_DEFAULT),
            ]);

            session()->regenerate(true);
            session()->set('tidb_user_id', $id);
            $profile = [
                'id' => $id,
                'nome' => $name,
                'email' => $email,
                'telefone' => $phone,
                'role' => 'cliente',
            ];
            return ['status' => 201, 'data' => ['user' => $this->userFromProfile($profile)], 'error' => null];
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao cadastrar usuário no TiDB ({exception}).', ['exception' => $exception::class]);
            $duplicate = str_contains(strtolower($exception->getMessage()), 'duplicate');
            return $this->failure($duplicate ? 409 : 503, $duplicate ? 'Já existe uma conta com este e-mail.' : 'Não foi possível criar a conta agora.');
        }
    }

    private function updateProfile(array $payload): array
    {
        $user = $this->currentUser();
        if ($user === null) {
            return $this->failure(401, 'Autenticação necessária.');
        }

        $metadata = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $allowed = ['nome', 'telefone', 'cep', 'bairro', 'logradouro', 'numero', 'complemento', 'avatar_url'];
        $updates = array_intersect_key($metadata, array_flip($allowed));
        if ($updates === []) {
            return $this->failure(400, 'Nenhum dado de perfil válido foi enviado.');
        }

        try {
            db_connect()->table('perfis')->where('id', $user['id'])->update($updates);
            $updated = $this->currentUser();
            return ['status' => 200, 'data' => ['user' => $updated], 'error' => null];
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao atualizar perfil no TiDB ({exception}).', ['exception' => $exception::class]);
            return $this->failure(503, 'Não foi possível atualizar o perfil agora.');
        }
    }

    private function userFromProfile(array $profile): array
    {
        return [
            'id'            => (string) $profile['id'],
            'email'         => (string) ($profile['email'] ?? ''),
            'user_metadata' => [
                'nome'       => $profile['nome'] ?? '',
                'telefone'   => $profile['telefone'] ?? '',
                'role'       => $profile['role'] ?? 'cliente',
                'avatar_url' => $profile['avatar_url'] ?? null,
            ],
        ];
    }

    private function failure(int $status, string $message): array
    {
        return ['status' => $status, 'data' => null, 'error' => ['message' => $message]];
    }
}
