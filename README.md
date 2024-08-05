# GitHub Action to check PHP Syntax

You may need to check if PHP files have a correct syntax.
For example, your project may support an old PHP version, and you want to check that pull requests are valid for that version.

You can use this GitHub Action to automatically check it.


## Requirements

You neen to install the PHP version you want to check your files against.
This usually is the lowest version supported by your project.

You need to enable the `opcache` PHP extension for PHP older than 8.3 (unless you enable the `support-duplicated-names` option).

This Action has been tested with PHP as old as PHP 5.3.


## Sample Usage

Let's say you want to check if your code and pull requests contain PHP files that are valid for PHP 7.2.

You can use a GitHub workflow like this:

```yaml
name: Check PHP Syntax

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
    tags-ignore:
      - "**"

jobs:
  check-php-syntax:
    name: Check PHP Syntax
    runs-on: ubuntu-latest
    steps:
      -
        name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          # This is the minimum PHP version supported by your project
          php-version: '7.2'
          extensions: opcache
          coverage: none
          tools: none
      -
        name: Checkout
        uses: actions/checkout@v4
      -
        name: Check syntax
        uses: mlocati/check-php-syntax@v1
        with:
          directory: .
          include: |
            bin/entrypoint1
            bin/entrypoint2
          exclude: |
            tests/shim1
            tests/shim2
```

### Sample Output

If someone submits a pull request containing this code:

```php
<?php

class Foo
{
    public int $bar;
}
```

Since it's invalid for PHP 7.2 (property types require PHP 7.4+), the Action will fail, and it will output the following message:

```
ERRORS FOUND!
Error #1) syntax error, unexpected 'int' (T_STRING), expecting function (T_FUNCTION) or const (T_CONST)
File: filename.php
Line: 5
```


## Options

### `directory`

You can use this option to specify the directory to be parsed (it can be an absolute path, or a path relative to the current directory).

If omitted, the current directory will be used

```yaml
with:
  directory: src
```

### `include`

The Action will parse all the files with a <code>.php</code> extension: you can use this option to include PHP files that don't have this extension (please use relative file names).

```yaml
with:
  include: |
    bin/entrypoint1
    bin/entrypoint2
```

### `exclude`

You can use this option to exclude specific directories and files (please use relative paths).

```yaml
with:
  exclude: |
    tests/stubs
    tests/shims
```

### `support-duplicated-names`

If your project may contain duplicated classes and functions, you may want to enable this option (on PHP 8.3+ it's ignored, it's always true).

Please remark that enabling this function makes the check much slower.

```yaml
with:
  support-duplicated-names: true
```

### `debug`

In order to print debug/verbose information, you can use this option.

```yaml
with:
  debug: true
```


## Do you really want to say thank you?

You can offer me a [monthly coffee](https://github.com/sponsors/mlocati) or a [one-time coffee](https://paypal.me/mlocati) :wink:
