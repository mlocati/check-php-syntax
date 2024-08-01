# GitHub Action to check PHP Syntax

You may need to check if PHP files have a correct syntax.
For example, your project may support an old PHP version, and you want to check that pull requests are valid for that version.

You can use this GitHub Action to automatically check it.


## Requirements

You need to enable the `opcache` PHP extension.

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
          php-version: '7.2'
          extensions: opcache
          coverage: none
          tools: none
      -
        name: Checkout
        uses: actions/checkout@v4
      -
        name: Check syntax
        uses: mlocati/check-php-syntax@main
        with:
          directory: .
          include: |
            bin/entrypoint1
            bin/entrypoint2
          exclude: |
            tests/shim1
            tests/shim2
```

## Options

<table>
  <thead>
    <tr>
      <th>Option</td>
      <td>Description</td>
      <td style="width: 180px">Example</td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>directory</code></td>
      <td>
        You can use this option to specify the directory to be parsed (it can be an absolute path, or a path relative to the current directory).<br />
        If omitted, the current directory will be used
      </td>
<td>
    
```yaml
with:
  directory: src
```

</td>
    </tr>
    <tr>
      <td><code>include</code></td>
      <td>
        The Action will parse all the files with a <code>.php</code> extension: you can use this option to include PHP files that don't have this extension (please use relative file names)
      </td>
<td>
    
```yaml
with:
  include: |
    bin/entrypoint
```

</td>
    </tr>
    <tr>
      <td><code>exclude</code></td>
      <td>
        You can use this option to exclude specific directories and files (please use relative paths)
      </td>
<td>
    
```yaml
with:
  exclude: |
    tests/stubs
```

</td>
    </tr>

  </tbody>
</table>
