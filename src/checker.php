<?php

set_error_handler(
    function ($errno, $errstr, $errfile, $errline) {
        $message = trim((string) $errstr) ?: "Error {$errno}";
        if ($errfile && $errfile !== 'Unknown') {
            $message .= "\nFile: {$errfile}";
            if ($errline) {
                $message .= "\nLine: {$errline}";
            }
        }
        throw new RuntimeException($message);
    },
    -1
);

class PHPSyntaxCheckResult
{
    /**
     * @var int
     */
    public $numFilesSkipped = 0;

    /**
     * @var int
     */
    public $numFilesChecked = 0;

    /**
     * @var string[]
     */
    public $errors = array();
}

class PHPSyntaxChecker
{
    /**
     * @var string
     */
    private $rootDir;

    private $includeFiles = array();

    private $excludePaths = array();

    public function __construct()
    {
        $this->rootDir = rtrim(getcwd(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    }

    /**
     * @param string $value
     *
     * @return $this
     */
    public function addIncludeFile($value)
    {
        if ($value === '') {
            throw new RuntimeException('Empty argument');
        }
        $value = trim(str_replace('/', DIRECTORY_SEPARATOR, $value), DIRECTORY_SEPARATOR);
        if ($value === '') {
            throw new RuntimeException('Invalid argument');
        }
        if (!is_file($this->rootDir . $value)) {
            throw new RuntimeException('The file does not exist');
        }
        $this->includeFiles[] = $value;

        return $this;
    }

    /**
     * @param string $value
     *
     * @return $this
     */
    public function addExcludePath($value)
    {
        if ($value === '') {
            throw new RuntimeException('Empty argument');
        }
        $value = trim(str_replace('/', DIRECTORY_SEPARATOR, $value), DIRECTORY_SEPARATOR);
        if ($value === '') {
            throw new RuntimeException('Invalid argument');
        }
        $this->excludePaths[] = $value;

        return $this;
    }

    /**
     * @return PHPSyntaxCheckResult
     */
    public function check()
    {
        $result = new PHPSyntaxCheckResult();
        $this->checkIn($result, '');
        foreach ($this->includeFiles as $phpFile) {
            $result->numFilesChecked++;
            $error = $this->checkFile($phpFile);
            if ($error !== '') {
                $result->errors[] = $error;
            }
        }

        return $result;
    }

    /**
     * @param string $relativeDirectory
     */
    private function checkIn(PHPSyntaxCheckResult $result, $relativeDirectory)
    {
        list($phpFiles, $subDirectories) = $this->getDirectoryContents($relativeDirectory);
        foreach ($phpFiles as $phpFile) {
            if ($this->isSkipFile($phpFile)) {
                $result->numFilesSkipped++;
            } else {
                $result->numFilesChecked++;
                $error = $this->checkFile($phpFile);
                if ($error !== '') {
                    $result->errors[] = $error;
                }
            }
        }
        foreach ($subDirectories as $subDirectory) {
            $this->checkIn($result, $subDirectory);
        }

        return $result;
    }

    /**
     * @return string
     */
    private function checkFile($phpFile)
    {
        $message = '';
        try {
            $compiled = opcache_compile_file($this->rootDir . $phpFile);
        } catch (ParseError $x) { // PHP >= 7.0
            return trim($x->getMessage()) . "\nFile: {$phpFile}\nLine: {$x->getLine()}";
        } catch (RuntimeException $x) { // PHP < 7.0
            $message = trim($x->getMessage());
            $compiled = false;
        }
        if ($compiled !== true) {
            if (!$message) {
                $message = 'Compilation failed';
            }
            return "{$message}\nFile: {$phpFile}";
        }

        return '';
    }

    /**
     * @param string $parentRelativeDir
     *
     * @return string[][]
     */
    private function getDirectoryContents($parentRelativeDir)
    {
        $phpFiles = array();
        $subDirectories = array();
        $parentAbsoluteDir = $this->rootDir . $parentRelativeDir;
        $items = scandir($parentAbsoluteDir);
        if ($items === false) {
            throw new RuntimeException("Failed to list contents of directory {$parentAbsoluteDir}");
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $itemRelative = $parentRelativeDir === '' ? $item : ($parentRelativeDir . DIRECTORY_SEPARATOR . $item);
            if (is_dir($this->rootDir . $itemRelative)) {
                $subDirectories[] = $itemRelative;
            } elseif (preg_match('/.\.php$/i', $item)) {
                $phpFiles[] = $itemRelative;
            }
        }

        return array($phpFiles, $subDirectories);
    }

    /**
     * @param string $phpFile
     *
     * @return bool
     */
    private function isSkipFile($phpFile)
    {
        if (in_array($phpFile, $this->excludePaths, true)) {
            return true;
        }
        foreach ($this->excludePaths as $excludePath) {
            if (strpos($phpFile, $excludePath . DIRECTORY_SEPARATOR) === 0) {
                return true;
            }
        }

        return false;
    }
}

if (!function_exists('opcache_get_status')) {
    echo "OPcache is not installed.\n";
    exit(2);
}
if (opcache_get_status() === false) {
    echo "OPcache is not enabled.\nYou may need to add this line to php.ini:\nopcache.enable_cli=1\n";
    exit(3);
}

$checker = new PHPSyntaxChecker();
foreach ($argv as $argvIndex => $argvValue) {
    if ($argvIndex < 1) {
        continue;
    }
    try {
        if ($argvValue !== '' && $argvValue[0] === '+') {
            $checker->addIncludeFile(substr($argvValue, 1));
        } elseif ($argvValue !== '' && $argvValue[0] === '-') {
            $checker->addExcludePath(substr($argvValue, 1));
        } else {
            throw new RuntimeException("Argument must start with a minus or a plus");
        }
    } catch (RuntimeException $x) {
        echo "Invalid argument {$argvIndex} (\"{$argvValue}\"): {$x->getMessage()}\n";
        exit(4);
    }
}

printf(
    "Checking files with PHP %s.%s.%s (please be sure it's the minimum supported version)... ",
    PHP_MAJOR_VERSION, PHP_MINOR_VERSION, PHP_RELEASE_VERSION
);
$result = $checker->check();
echo "files checked: {$result->numFilesChecked} (skipped: {$result->numFilesSkipped}).\n";
if ($result->errors === array()) {
    echo "No errors found.\n";
} else {
    echo "ERRORS FOUND!\n";
    foreach ($result->errors as $index => $error) {
        echo 'Error #', $index + 1, ') ', $error, "\n";
    }
}


exit($result->errors === array() ? 0 : 1);
