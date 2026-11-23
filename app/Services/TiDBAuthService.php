<?php

namespace App\Services;

use App\Filters\RateLimitFilter;
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
        // Limite por conta, além do limite por IP: impede testar senhas de um e-mail trocando de IP.
        if (\Config\Services::throttler()->check('login_conta_' . md5($email), 20, 900) === false) {
            return $this->failure(429, 'Muitas tentativas para esta conta. Aguarde alguns minutos e tente de novo.');
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
            $this->registrarAcesso((string) $profile['id'], 'login');
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

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 128 || $name === ''
            || mb_strlen($name) > 120 || mb_strlen($phone) > 30) {
            return $this->failure(400, 'Informe nome, e-mail válido e senha entre 8 e 128 caracteres.');
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
            $this->registrarAcesso($id, 'cadastro');
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
        if (array_key_exists('avatar_url', $updates) && !self::avatarUrlValida($updates['avatar_url'], $user['id'])) {
            return $this->failure(400, 'Foto de perfil inválida.');
        }

        try {
            db_connect()->table('perfis')->where('id', $user['id'])->update($updates);
            if (array_key_exists('avatar_url', $updates)) {
                (new PrivacidadeService())->limparFotosNaoUsadas($user['id']);
            }
            $updated = $this->currentUser();
            return ['status' => 200, 'data' => ['user' => $updated], 'error' => null];
        } catch (Throwable $exception) {
            log_message('error', 'Falha ao atualizar perfil no TiDB ({exception}).', ['exception' => $exception::class]);
            return $this->failure(503, 'Não foi possível atualizar o perfil agora.');
        }
    }

    /**
     * A foto de perfil só pode ser vazia ou uma imagem enviada pelo próprio usuário ao
     * storage do site (fotos-perfil/<id>/... ou produtos/avatars/<id>/...). Assim ninguém grava
     * um link externo (rastreador) ou um endereço "javascript:" como foto.
     */
    public static function avatarUrlValida(mixed $url, string $userId): bool
    {
        if ($url === null || $url === '') {
            return true;
        }
        if (!is_string($url) || strlen($url) > 1000 || $userId === '') {
            return false;
        }
        $partes = parse_url($url);
        if (!is_array($partes)
            || !preg_match('#(^|/)api/storage/public/?$#', (string) ($partes['path'] ?? ''))
            || (isset($partes['scheme']) && !in_array(strtolower($partes['scheme']), ['http', 'https'], true))
            || empty($partes['query'])) {
            return false;
        }
        parse_str($partes['query'], $parametros);
        $bucket = $parametros['bucket'] ?? '';
        $caminho = $parametros['path'] ?? '';
        if (!is_string($bucket) || !is_string($caminho)) {
            return false;
        }
        return ($bucket === 'fotos-perfil' && str_starts_with($caminho, $userId . '/'))
            || ($bucket === 'produtos' && str_starts_with($caminho, 'avatars/' . $userId . '/'));
    }

    private function registrarAcesso(string $userId, string $evento): void
    {
        (new PrivacidadeService())->registrarAcesso($userId, $evento, RateLimitFilter::clientIp(service('request')));
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
