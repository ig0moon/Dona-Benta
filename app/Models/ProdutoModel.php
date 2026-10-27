<?php

namespace App\Models;

use CodeIgniter\Model;

class ProdutoModel extends Model
{
    protected $table            = 'produtos';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;
    protected $allowedFields    = [
        'id',
        'nome',
        'descricao',
        'categoria',
        'preco',
        'foto_url',
        'destaque',
        'ativo',
        'created_at',
        'updated_at'
    ];

    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Categorias padrão da confeitaria
     */
    public function getCategorias(): array
    {
        return [
            'bolos'    => ['nome' => 'Bolos', 'icone' => 'cake'],
            'paes'     => ['nome' => 'Pães', 'icone' => 'bakery_dining'],
            'doces'    => ['nome' => 'Doces', 'icone' => 'cookie'],
            'salgados' => ['nome' => 'Salgados', 'icone' => 'lunch_dining'],
            'tortas'   => ['nome' => 'Tortas', 'icone' => 'icecream'],
        ];
    }
}
