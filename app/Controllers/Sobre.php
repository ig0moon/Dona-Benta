<?php

namespace App\Controllers;

class Sobre extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Sobre Nós — Panificadora Dona Benta',
            'descricao' => 'Conheça a história e os valores da Panificadora Dona Benta Artesanal. Receitas de família feitas com amor.',
            'pagina'    => 'sobre'
        ];

        return view('paginas/sobre', $data);
    }
}
