<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Content Security Policy configurada e blindada para a Dona Benta
 */
class ContentSecurityPolicy extends BaseConfig
{
    public bool $reportOnly = false;
    public ?string $reportURI = null;
    public ?string $reportTo = null;
    public bool $upgradeInsecureRequests = false;

    public $defaultSrc = 'self';

    public $scriptSrc = [
        'self',
        'unsafe-inline',
        'https://cdn.jsdelivr.net',
        'https://sdk.mercadopago.com',
        'https://http2.mlstatic.com'
    ];

    public array|string $scriptSrcElem = [
        'self',
        'unsafe-inline',
        'https://cdn.jsdelivr.net',
        'https://sdk.mercadopago.com',
        'https://http2.mlstatic.com'
    ];

    public array|string $scriptSrcAttr = [
        'self',
        'unsafe-inline'
    ];

    public $styleSrc = [
        'self',
        'unsafe-inline',
        'https://fonts.googleapis.com'
    ];

    public array|string $styleSrcElem = [
        'self',
        'unsafe-inline',
        'https://fonts.googleapis.com'
    ];

    public array|string $styleSrcAttr = [
        'self',
        'unsafe-inline'
    ];

    public $imageSrc = [
        'self',
        'data:',
        'blob:',
        'https://images.unsplash.com',
        'https://nxigfuivadxjotlqrwux.supabase.co',
        'https://*.supabase.co',
        'https://http2.mlstatic.com'
    ];

    public $baseURI = 'self';
    public $childSrc = 'self';

    public $connectSrc = [
        'self',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'https://nxigfuivadxjotlqrwux.supabase.co',
        'https://*.supabase.co',
        'https://api.mercadopago.com',
        'https://viacep.com.br'
    ];

    public $fontSrc = [
        'self',
        'https://fonts.gstatic.com'
    ];

    public $formAction = 'self';
    public $frameAncestors = 'self';

    public $frameSrc = [
        'self',
        'https://sdk.mercadopago.com',
        'https://www.mercadopago.com'
    ];

    public $mediaSrc = 'self';
    public $objectSrc = 'none';
    public $manifestSrc = 'self';
    public array|string $workerSrc = ['self', 'blob:'];

    public ?string $pluginTypes = null;
    public ?string $sandbox = null;

    public string $styleNonceTag = '{csp-style-nonce}';
    public string $scriptNonceTag = '{csp-script-nonce}';
    public bool $autoNonce = false;
}
