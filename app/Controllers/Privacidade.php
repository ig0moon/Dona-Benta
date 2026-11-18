<?php

namespace App\Controllers;

class Privacidade extends BaseController
{
    public function index(): string
    {
        $data = [
            'titulo'    => 'Política de Privacidade — Panificadora Dona Benta',
            'descricao' => 'Como a Panificadora Dona Benta coleta, usa e protege os dados pessoais dos clientes, conforme a LGPD.',
            'pagina'    => 'privacidade',
            'loja'      => config('Loja'),
        ];

        return view('paginas/privacidade', $data);
    }
}
