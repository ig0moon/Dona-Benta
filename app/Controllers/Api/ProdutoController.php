<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\ProdutoModel;
use CodeIgniter\HTTP\ResponseInterface;

class ProdutoController extends BaseController
{
    /**
     * Retorna a lista de produtos cadastrados no MySQL
     * GET /api/produtos?categoria=bolos
     */
    public function index(): ResponseInterface
    {
        $model = new ProdutoModel();
        $categoria = $this->request->getGet('categoria');

        $builder = $model->where('ativo', 1);
        if (!empty($categoria) && $categoria !== 'todos') {
            $builder->where('categoria', $categoria);
        }

        $produtos = $builder->orderBy('destaque', 'DESC')->orderBy('created_at', 'DESC')->findAll();

        return $this->response->setJSON([
            'sucesso'  => true,
            'origem'   => 'mysql',
            'produtos' => $produtos,
            'total'    => count($produtos)
        ]);
    }

    /**
     * Retorna detalhes de um produto específico
     * GET /api/produtos/{id}
     */
    public function show(string $id): ResponseInterface
    {
        $model = new ProdutoModel();
        $produto = $model->find($id);

        if (!$produto) {
            return $this->response->setStatusCode(404)->setJSON(['erro' => 'Produto não encontrado']);
        }

        return $this->response->setJSON([
            'sucesso' => true,
            'origem'  => 'mysql',
            'produto' => $produto
        ]);
    }
}
