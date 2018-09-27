librdkafkaVersion = '0.11.5'
depsPrecompiledDir = '../deps/precompiled'
depsIncludeDir = '../deps/include'
buildReleaseDir = 'Release'

librdkafkaNugetUrl = 'https://api.nuget.org/v3-flatcontainer/librdkafka.redist/{}/librdkafka.redist.{}.nupkg'.format(librdkafkaVersion, librdkafkaVersion)
outputDir = 'librdkafka.redist'
outputFile = outputDir + '.zip'
dllPath = outputDir + '/runtimes/win7-x64/native'
libPath = outputDir + '/build/native/lib/win7/x64/win7-x64-Release/v120'
includePath = outputDir + '/build/native/include/librdkafka'
bundledDllsZip = '../deps/windows-install.zip'

# download librdkafka frmo nuget
import urllib2
filedata = urllib2.urlopen(librdkafkaNugetUrl)
datatowrite = filedata.read()
with open(outputFile, 'wb') as f:  
    f.write(datatowrite)

# extract package
import zipfile
zip_ref = zipfile.ZipFile(outputFile, 'r')
zip_ref.extractall(outputDir)
zip_ref.close()

# copy files
import shutil, os, errno

def createdir(dir):
    try:
        os.makedirs(dir)
    except OSError as e:
        if errno.EEXIST != e.errno:
            raise

createdir(depsPrecompiledDir)
createdir(depsIncludeDir)
createdir(buildReleaseDir)

shutil.copy2(dllPath + '/zlib.dll', depsPrecompiledDir)
shutil.copy2(dllPath + '/librdkafka.dll', depsPrecompiledDir)
shutil.copy2(dllPath + '/librdkafkacpp.dll', depsPrecompiledDir)

shutil.copy2(libPath + '/librdkafka.lib', depsPrecompiledDir)
shutil.copy2(libPath + '/librdkafkacpp.lib', depsPrecompiledDir)

shutil.copy2(includePath + '/rdkafka.h', depsIncludeDir)
shutil.copy2(includePath + '/rdkafkacpp.h', depsIncludeDir)

shutil.copy2(dllPath + '/zlib.dll', buildReleaseDir)
shutil.copy2(dllPath + '/librdkafka.dll', buildReleaseDir)
shutil.copy2(dllPath + '/librdkafkacpp.dll', buildReleaseDir)

# unfortunately vs2015 build tools are not shipped with msvcp120.dll (only msvcr120.dll is included)
# librdkafka nuget package also only ships with msvcr120.dll
zip_ref = zipfile.ZipFile(bundledDllsZip, 'r')
zip_ref.extractall(buildReleaseDir)
zip_ref.close()

# clean up
os.remove(outputFile)
shutil.rmtree(outputDir)
