<?php

namespace App\Controllers;

class Home extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Dona Benta — Confeitaria e Padaria Artesanal',
            'descricao' => 'Dona Benta — Confeitaria e Padaria Artesanal em Ponta Grossa. Pães de fermentação natural, bolos caseiros, doces e tortas para encomenda.',
            'pagina'    => 'inicio'
        ];

        return view('home/index', $data);
    }
}
