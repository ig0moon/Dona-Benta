<?php

namespace App\Controllers;

class Auth extends BaseController
{
    public function login(): string
    {
        $data = [
            'titulo'    => 'Entrar / Criar Conta — Panificadora Dona Benta',
            'descricao' => 'Acesse ou crie sua conta na Panificadora Dona Benta para encomendar bolos, pães e doces artesanais.',
            'pagina'    => 'login'
        ];

        return view('auth/login', $data);
    }
}
