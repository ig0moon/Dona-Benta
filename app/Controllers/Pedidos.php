<?php

namespace App\Controllers;

class Pedidos extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Finalizar e Agendar Pedido — Panificadora Dona Benta',
            'descricao' => 'Agende a retirada ou entrega de sua encomenda artesanal na Panificadora Dona Benta.',
            'pagina'    => 'pedidos'
        ];

        return view('pedidos/index', $data);
    }
}
