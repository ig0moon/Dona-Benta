<?php

use CodeIgniter\Test\CIUnitTestCase;
use Config\App;
use Tests\Support\Libraries\ConfigReader;

/**
 * @internal
 */
final class HealthTest extends CIUnitTestCase
{
    public function testIsDefinedAppPath(): void
    {
        $this->assertDirectoryExists(APPPATH);
    }

    public function testBaseUrlHasBeenSet(): void
    {
        $validation = service('validation');

        $env = false;

        // Check the baseURL in .env
        if (is_file(HOMEPATH . '.env')) {
            $env = preg_grep('/^app\.baseURL = ./', file(HOMEPATH . '.env')) !== false;
        }

        if ($env) {
            // BaseURL in .env is a valid URL?
            // phpunit.dist.xml sets app.baseURL in $_SERVER
            // So if you set app.baseURL in .env, it takes precedence
            $config = new App();
            $this->assertTrue(
                $validation->check($config->baseURL, 'valid_url'),
                'baseURL "' . $config->baseURL . '" in .env is not valid URL',
            );
        }

        // Get the baseURL in app/Config/App.php
        // You can't use Config\App, because phpunit.dist.xml sets app.baseURL
        $reader = new ConfigReader();

        // BaseURL in app/Config/App.php is a valid URL?
        $this->assertTrue(
            $validation->check($reader->baseURL, 'valid_url'),
            'baseURL "' . $reader->baseURL . '" in app/Config/App.php is not valid URL',
        );
    }

    public function testRenderExternalUrlIsUsedWhenAppBaseUrlIsNotSet(): void
    {
        $keys = ['APP_BASE_URL', 'RENDER_EXTERNAL_URL'];
        $original = [];

        foreach ($keys as $key) {
            $original[$key] = [
                'envExists'    => array_key_exists($key, $_ENV),
                'env'          => $_ENV[$key] ?? null,
                'serverExists' => array_key_exists($key, $_SERVER),
                'server'       => $_SERVER[$key] ?? null,
                'process'      => getenv($key),
            ];
            unset($_ENV[$key], $_SERVER[$key]);
            putenv($key);
        }

        try {
            $_ENV['RENDER_EXTERNAL_URL'] = 'https://dona-benta.onrender.com';
            $this->assertSame('https://dona-benta.onrender.com/', (new App())->baseURL);

            $_ENV['APP_BASE_URL'] = 'https://loja.example.com';
            $this->assertSame('https://loja.example.com/', (new App())->baseURL);
        } finally {
            foreach ($original as $key => $values) {
                if ($values['envExists']) {
                    $_ENV[$key] = $values['env'];
                } else {
                    unset($_ENV[$key]);
                }

                if ($values['serverExists']) {
                    $_SERVER[$key] = $values['server'];
                } else {
                    unset($_SERVER[$key]);
                }

                if ($values['process'] === false) {
                    putenv($key);
                } else {
                    putenv($key . '=' . $values['process']);
                }
            }
        }
    }

    public function testDatabaseConnectionUsesRuntimeEnvironmentConfiguration(): void
    {
        $keys = [
            'DB_HOST',
            'DB_USER',
            'DB_PASS',
            'DB_NAME',
            'DB_DRIVER',
            'DB_PREFIX',
            'DB_ENCRYPT',
            'DB_PORT',
            'database.default.hostname',
            'database.default.username',
            'database.default.password',
            'database.default.database',
            'database.default.DBDriver',
            'database.default.DBPrefix',
            'database.default.encrypt',
            'database.default.port',
        ];
        $original = [];

        foreach ($keys as $key) {
            $original[$key] = [
                'envExists'    => array_key_exists($key, $_ENV),
                'env'          => $_ENV[$key] ?? null,
                'serverExists' => array_key_exists($key, $_SERVER),
                'server'       => $_SERVER[$key] ?? null,
                'process'      => getenv($key),
            ];
            unset($_ENV[$key], $_SERVER[$key]);
            putenv($key);
        }

        try {
            $_ENV['DB_HOST'] = 'tidb-render.example.com';
            $_ENV['DB_USER'] = 'render_user';
            $_ENV['DB_PASS'] = 'render-password';
            $_ENV['DB_NAME'] = 'render_database';
            $_ENV['DB_DRIVER'] = 'MySQLi';
            $_ENV['DB_PREFIX'] = 'render_';
            $_ENV['DB_ENCRYPT'] = 'true';
            $_ENV['DB_PORT'] = '4001';
            $_ENV['database.default.hostname'] = 'tidb.example.com';
            $_ENV['database.default.username'] = 'tidb_user';
            $_ENV['database.default.password'] = 'test-password';
            $_ENV['database.default.database'] = 'dona_benta';
            $_ENV['database.default.DBDriver'] = 'SQLite3';
            $_ENV['database.default.DBPrefix'] = 'shop_';
            $_ENV['database.default.encrypt'] = 'false';
            $_ENV['database.default.port'] = '4000';

            $database = new \Config\Database();

            $this->assertSame('tidb-render.example.com', $database->default['hostname']);
            $this->assertSame('render_user', $database->default['username']);
            $this->assertSame('render-password', $database->default['password']);
            $this->assertSame('render_database', $database->default['database']);
            $this->assertSame('MySQLi', $database->default['DBDriver']);
            $this->assertSame('render_', $database->default['DBPrefix']);
            $this->assertSame([], $database->default['encrypt']);
            $this->assertSame(4001, $database->default['port']);

            foreach (['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_DRIVER', 'DB_PREFIX', 'DB_ENCRYPT', 'DB_PORT'] as $key) {
                unset($_ENV[$key]);
            }
            $legacyConfig = new \Config\Database();
            $this->assertSame('tidb.example.com', $legacyConfig->default['hostname']);
            $this->assertSame('tidb_user', $legacyConfig->default['username']);
            $this->assertSame('test-password', $legacyConfig->default['password']);
            $this->assertSame('dona_benta', $legacyConfig->default['database']);
            $this->assertFalse($legacyConfig->default['encrypt']);
            $this->assertSame(4000, $legacyConfig->default['port']);
        } finally {
            foreach ($original as $key => $values) {
                if ($values['envExists']) {
                    $_ENV[$key] = $values['env'];
                } else {
                    unset($_ENV[$key]);
                }

                if ($values['serverExists']) {
                    $_SERVER[$key] = $values['server'];
                } else {
                    unset($_SERVER[$key]);
                }

                if ($values['process'] === false) {
                    putenv($key);
                } else {
                    putenv($key . '=' . $values['process']);
                }
            }
        }
    }
}
