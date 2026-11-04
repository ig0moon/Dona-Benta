<?php

namespace App\Services;

use CodeIgniter\HTTP\Files\UploadedFile;

class SupabaseProxyService
{
    private string $url;
    private string $anonKey;

    public function __construct()
    {
        $this->url     = rtrim((string) env('SUPABASE_URL', ''), '/');
        $this->anonKey = (string) env('SUPABASE_ANON_KEY', '');
    }

    public function auth(string $action, array $payload = []): array
    {
        $paths = [
            'login'    => ['POST', '/auth/v1/token?grant_type=password'],
            'signup'   => ['POST', '/auth/v1/signup'],
            'update'   => ['PUT', '/auth/v1/user'],
        ];
        if ($action === 'recovery') {
            $redirect = rtrim((string) env('APP_BASE_URL', ''), '/') . '/login';
            $path = '/auth/v1/recover?redirect_to=' . rawurlencode($redirect);
            $result = $this->request('POST', $path, $payload, null);
            return $result;
        }

        if (!isset($paths[$action])) {
            return $this->failure(400, 'Ação de autenticação inválida.');
        }

        [$method, $path] = $paths[$action];
        $token = $action === 'update' ? $this->accessToken() : null;
        $result = $this->request($method, $path, $payload, $token);

        if ($result['status'] >= 200 && $result['status'] < 300 && isset($result['data']['access_token'])) {
            $this->storeSession($result['data']);
        }

        if ($action === 'update' && $result['status'] >= 200 && $result['status'] < 300 && isset($result['data'])) {
            $session = session();
            $auth = $session->get('supabase_auth') ?? [];
            $auth['user'] = $result['data'];
            $session->set('supabase_auth', $auth);
            $result['data'] = ['user' => $result['data']];
        }

        return $result;
    }

    public function logout(): void
    {
        $token = $this->accessToken();
        if ($token !== null) {
            $this->request('POST', '/auth/v1/logout', null, $token);
        }

        session()->remove('supabase_auth');
        session()->regenerate(true);
    }

    public function currentUser(): ?array
    {
        $token = $this->accessToken();
        if ($token === null) {
            return null;
        }

        $auth = session()->get('supabase_auth');
        return is_array($auth['user'] ?? null) ? $auth['user'] : null;
    }

    public function authorizationHeader(): ?string
    {
        $token = $this->accessToken();
        return $token === null ? null : 'Bearer ' . $token;
    }

    public function databaseRequest(string $method, string $table, array $query, mixed $payload = null): array
    {
        if (!in_array($table, ['perfis', 'produtos', 'pedidos', 'itens_pedido'], true)) {
            return $this->failure(404, 'Recurso não encontrado.');
        }

        $countExact = isset($query['count']);
        unset($query['count'], $query['head']);
        $queryString = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        $path = '/rest/v1/' . $table . ($queryString === '' ? '' : '?' . $queryString);

        $headers = [];
        if ($method === 'POST') {
            $headers[] = 'Prefer: resolution=merge-duplicates,return=representation';
        } elseif (in_array($method, ['PATCH', 'DELETE'], true)) {
            $headers[] = 'Prefer: return=representation';
        }
        if ($countExact) {
            $headers[] = 'Prefer: count=exact';
        }

        return $this->request($method, $path, $payload, $this->accessToken(), $headers);
    }

    public function upload(string $bucket, string $path, UploadedFile $file, bool $upsert): array
    {
        if (!in_array($bucket, ['produtos', 'fotos-perfil'], true) || !$file->isValid()) {
            return $this->failure(400, 'Arquivo ou destino de upload inválido.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getTempName());
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return $this->failure(415, 'Envie uma imagem JPG, PNG ou WEBP.');
        }
        if (preg_match('#(^|/)\.\.?(/|$)|[^a-zA-Z0-9._/-]#', $path) || $path === '') {
            return $this->failure(400, 'Caminho de arquivo inválido.');
        }

        $bytes = file_get_contents($file->getTempName());
        if ($bytes === false) {
            return $this->failure(400, 'Não foi possível ler o arquivo enviado.');
        }

        return $this->request(
            'POST',
            '/storage/v1/object/' . $bucket . '/' . implode('/', array_map('rawurlencode', explode('/', $path))),
            $bytes,
            $this->accessToken(),
            [
                'Content-Type: ' . $mime,
                'x-upsert: ' . ($upsert ? 'true' : 'false'),
            ],
            false,
        );
    }

    public function publicObject(string $bucket, string $path): array
    {
        if (!in_array($bucket, ['produtos', 'fotos-perfil'], true)
            || $path === ''
            || preg_match('#(^|/)\.\.?(/|$)|[^a-zA-Z0-9._/-]#', $path)) {
            return $this->failure(404, 'Arquivo não encontrado.');
        }

        $result = $this->request(
            'GET',
            '/storage/v1/object/public/' . $bucket . '/' . implode('/', array_map('rawurlencode', explode('/', $path))),
            null,
            null,
            [],
            false,
            true,
        );
        $contentType = strtolower(trim(explode(';', (string) ($result['content_type'] ?? ''))[0]));
        if ($result['status'] >= 200 && $result['status'] < 300
            && !in_array($contentType, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return $this->failure(404, 'Arquivo não encontrado.');
        }
        return $result;
    }

    private function accessToken(): ?string
    {
        $session = session();
        $auth = $session->get('supabase_auth');
        if (!is_array($auth) || empty($auth['access_token'])) {
            return null;
        }

        if (($auth['expires_at'] ?? 0) <= time() + 30 && !empty($auth['refresh_token'])) {
            $result = $this->request(
                'POST',
                '/auth/v1/token?grant_type=refresh_token',
                ['refresh_token' => $auth['refresh_token']],
                null,
            );
            if ($result['status'] >= 200 && $result['status'] < 300 && isset($result['data']['access_token'])) {
                $this->storeSession($result['data']);
                $auth = $session->get('supabase_auth');
            } else {
                $session->remove('supabase_auth');
                return null;
            }
        }

        return $auth['access_token'] ?? null;
    }

    private function storeSession(array $data): void
    {
        if (empty($data['access_token'])) {
            return;
        }

        session()->set('supabase_auth', [
            'access_token'  => $data['access_token'],
            'refresh_token' => $data['refresh_token'] ?? null,
            'expires_at'    => (int) ($data['expires_at'] ?? (time() + (int) ($data['expires_in'] ?? 3600))),
            'user'          => $data['user'] ?? null,
        ]);
        session()->regenerate();
    }

    private function request(
        string $method,
        string $path,
        mixed $payload = null,
        ?string $userToken = null,
        array $extraHeaders = [],
        bool $jsonPayload = true,
        bool $rawResponse = false,
    ): array {
        $parts = parse_url($this->url);
        if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || $this->anonKey === '') {
            return $this->failure(503, 'Integração Supabase não configurada no servidor.');
        }

        $headers = [
            'apikey: ' . $this->anonKey,
            'Authorization: Bearer ' . ($userToken ?? $this->anonKey),
        ];
        if ($jsonPayload) {
            $headers[] = 'Content-Type: application/json';
        }
        $headers = array_merge($headers, $extraHeaders);

        $ch = curl_init($this->url . $path);
        $responseHeaders = [];
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HEADERFUNCTION => static function ($curl, string $header) use (&$responseHeaders): int {
                $parts = explode(':', $header, 2);
                if (count($parts) === 2) {
                    $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return strlen($header);
            },
        ];
        if ($method === 'HEAD') {
            $options[CURLOPT_NOBODY] = true;
        }
        if ($payload !== null) {
            $options[CURLOPT_POSTFIELDS] = $jsonPayload ? json_encode($payload) : $payload;
        }

        curl_setopt_array($ch, $options);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($body === false || $error !== '') {
            log_message('error', '[Supabase proxy] Requisição falhou: ' . $error);
            return $this->failure(502, 'Não foi possível comunicar com o serviço de dados.');
        }

        if ($rawResponse) {
            return [
                'status'       => $status,
                'data'         => $body,
                'content_type' => $contentType,
                'error'        => null,
            ];
        }

        $data = json_decode($body, true);
        $errorData = $status >= 400
            ? (is_array($data) ? $data : ['message' => 'Falha ao consultar o serviço de dados.'])
            : null;

        return [
            'status' => $status,
            'data'   => $data,
            'error'  => $errorData,
            'count'  => $this->parseCount($responseHeaders['content-range'] ?? null),
        ];
    }

    private function parseCount(?string $contentRange): ?int
    {
        if ($contentRange !== null && preg_match('#/(\d+)$#', $contentRange, $matches)) {
            return (int) $matches[1];
        }
        return null;
    }

    private function failure(int $status, string $message): array
    {
        return [
            'status' => $status,
            'data'   => null,
            'error'  => ['message' => $message],
        ];
    }
}
