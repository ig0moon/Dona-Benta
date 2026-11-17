<?php

use App\Controllers\Api\FrontendController;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class StorageUrlTest extends CIUnitTestCase
{
    private function reescrever(mixed $valor): mixed
    {
        $controller = new class () extends FrontendController {
            public function reescrever(mixed $valor): mixed
            {
                return $this->rewriteStorageUrls($valor);
            }
        };

        return $controller->reescrever($valor);
    }

    public function testStoredImageFromAnotherHostPointsToTheCurrentSite(): void
    {
        $dados = [[
            'nome' => 'Bolo',
            'imagem_url' => 'https://dona-benta.onrender.com/api/storage/public?bucket=produtos&path=produtos%2F17-bolo.jpg',
            'perfil' => ['avatar_url' => 'http://localhost:8080/api/storage/public?bucket=fotos-perfil&path=abc%2Ffoto.jpg'],
        ]];

        $resultado = $this->reescrever($dados);

        $this->assertSame(base_url('api/storage/public') . '?bucket=produtos&path=produtos%2F17-bolo.jpg', $resultado[0]['imagem_url']);
        $this->assertSame(base_url('api/storage/public') . '?bucket=fotos-perfil&path=abc%2Ffoto.jpg', $resultado[0]['perfil']['avatar_url']);
        $this->assertSame('Bolo', $resultado[0]['nome']);
    }

    public function testOtherUrlsAreLeftAlone(): void
    {
        $externa = 'https://images.unsplash.com/photo-123?w=800';
        $semParametros = 'https://exemplo.com/api/storage/public';

        $this->assertSame($externa, $this->reescrever($externa));
        $this->assertSame($semParametros, $this->reescrever($semParametros));
        $this->assertSame(42, $this->reescrever(42));
        $this->assertNull($this->reescrever(null));
    }
}
