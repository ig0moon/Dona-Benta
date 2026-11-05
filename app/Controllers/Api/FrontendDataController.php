<?php

namespace App\Controllers\Api;

use App\Services\TiDBDataService;
use CodeIgniter\HTTP\ResponseInterface;

class FrontendDataController extends FrontendController
{
    private TiDBDataService $database;

    public function __construct()
    {
        $this->database = new TiDBDataService();
    }

    public function handle(string $table): ResponseInterface
    {
        if ($blocked = $this->rejectCrossOrigin()) {
            return $blocked;
        }

        $method = strtoupper($this->request->getMethod());
        if (!in_array($method, ['GET', 'POST', 'PATCH', 'DELETE'], true)) {
            return $this->response->setStatusCode(405)->setJSON(['data' => null, 'error' => ['message' => 'Método não permitido.']]);
        }

        $query = $this->validatedQuery();
        if ($query === null) {
            return $this->response->setStatusCode(400)->setJSON(['data' => null, 'error' => ['message' => 'Consulta inválida.']]);
        }

        $head = ($query['head'] ?? '') === 'true';
        unset($query['head']);
        if ($head) {
            $method = 'HEAD';
        }
        $payload = null;
        if (in_array($method, ['POST', 'PATCH'], true)) {
            $payload = $this->request->getJSON(true);
            if (!is_array($payload)) {
                return $this->response->setStatusCode(400)->setJSON(['data' => null, 'error' => ['message' => 'Corpo JSON inválido.']]);
            }
        }

        return $this->result($this->database->databaseRequest($method, $table, $query, $payload));
    }

    private function validatedQuery(): ?array
    {
        $input = $this->request->getGet();
        $query = [];
        foreach ($input as $key => $value) {
            if (!is_string($value) || strlen($value) > 2000) {
                return null;
            }

            if (in_array($key, ['select', 'order', 'limit', 'offset'], true)) {
                if ($key === 'select' && !preg_match('/^[a-zA-Z0-9_.*(),: ]+$/', $value)) {
                    return null;
                }
                if ($key === 'order' && !preg_match('/^[a-zA-Z0-9_., ]+$/', $value)) {
                    return null;
                }
                if (in_array($key, ['limit', 'offset'], true) && !ctype_digit($value)) {
                    return null;
                }
                if ($key === 'limit') {
                    $value = (string) min(1000, (int) $value);
                }
                $query[$key] = $value;
                continue;
            }
            if ($key === 'head' || $key === 'count') {
                if (!in_array($value, ['true', 'exact'], true)) {
                    return null;
                }
                $query[$key] = $value;
                continue;
            }

            if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_.]*$/', $key)
                || !preg_match('/^(eq|neq|in|is|gt|gte|lt|lte)\./', $value)
                || preg_match('/[\x00-\x1F\x7F]/', $value)) {
                return null;
            }
            $query[$key] = $value;
        }
        return $query;
    }
}
