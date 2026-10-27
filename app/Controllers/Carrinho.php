<?php

namespace App\Controllers;

class Carrinho extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Carrinho de Compras — Dona Benta',
            'descricao' => 'Revise os itens do seu carrinho e prossiga para o agendamento de retirada ou entrega na Dona Benta.',
            'pagina'    => 'carrinho'
        ];

        return view('carrinho/index', $data);
    }
}
