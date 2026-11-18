<?php

namespace App\Controllers;

class Termos extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Termos e Condições — Dona Benta',
            'descricao' => 'Condições de compra, entrega, pagamento e cancelamento dos pedidos da Dona Benta.',
            'pagina'    => 'termos',
            'loja'      => config('Loja'),
        ];

        return view('paginas/termos', $data);
    }
}
