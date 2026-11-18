<?php

namespace App\Controllers;

class Faq extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Dúvidas Frequentes — Panificadora Dona Benta',
            'descricao' => 'Perguntas frequentes sobre encomendas, formas de entrega, prazos e pagamentos na Panificadora Dona Benta.',
            'pagina'    => 'faq'
        ];

        return view('paginas/faq', $data);
    }
}
