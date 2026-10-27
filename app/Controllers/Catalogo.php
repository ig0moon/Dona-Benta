<?php

namespace App\Controllers;

use App\Models\ProdutoModel;

class Catalogo extends BaseController
{
    public function index(): string
    {
        $categoria = $this->request->getGet('categoria') ?? 'todos';
        $produtoModel = new ProdutoModel();

        $data = [
            'titulo'     => 'Catálogo de Produtos Artesanais — Dona Benta',
            'descricao'  => 'Explore o catálogo da Dona Benta: bolos, pães artesanais, doces finos, tortas e salgados. Encomende online.',
            'pagina'     => 'catalogo',
            'categoria'  => $categoria,
            'categorias' => $produtoModel->getCategorias()
        ];

        return view('catalogo/index', $data);
    }

    public function produto(): string
    {
        $id = $this->request->getGet('id');

        $data = [
            'titulo'    => 'Detalhes do Produto — Dona Benta',
            'descricao' => 'Detalhes do produto, preço e encomenda artesanal na Dona Benta Confeitaria e Padaria.',
            'pagina'    => 'produto',
            'produtoId' => $id
        ];

        return view('produto/index', $data);
    }
}
