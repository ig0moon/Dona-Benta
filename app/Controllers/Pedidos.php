<?php

namespace App\Controllers;

class Pedidos extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Finalizar e Agendar Pedido — Dona Benta',
            'descricao' => 'Agende a retirada ou entrega de sua encomenda artesanal na Dona Benta Confeitaria e Padaria.',
            'pagina'    => 'pedidos'
        ];

        return view('pedidos/index', $data);
    }
}
