<?php

namespace App\Controllers;

class Conta extends BaseController
{
    public function index(): string
    {
        $aba = $this->request->getGet('aba') ?? 'perfil';

        $data = [
            'titulo'    => 'Minha Conta — Dona Benta',
            'descricao' => 'Gerencie sua conta, pedidos e dados pessoais na Dona Benta Confeitaria e Padaria Artesanal.',
            'pagina'    => 'conta',
            'aba'       => $aba
        ];

        return view('conta/index', $data);
    }
}
