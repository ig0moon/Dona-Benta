<?php

namespace App\Controllers;

class Sobre extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Sobre Nós — Dona Benta',
            'descricao' => 'Conheça a história e os valores da Dona Benta Confeitaria e Padaria Artesanal. Receitas de família feitas com amor.',
            'pagina'    => 'sobre'
        ];

        return view('paginas/sobre', $data);
    }
}
