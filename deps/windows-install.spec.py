import base64
import importlib.util
import os
import unittest


SCRIPT_PATH = os.path.join(os.path.dirname(__file__), 'windows-install.py')
SPEC = importlib.util.spec_from_file_location('windows_install', SCRIPT_PATH)
WINDOWS_INSTALL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(WINDOWS_INSTALL)


class CreateNugetRequestTest(unittest.TestCase):
  def test_creates_request_without_headers(self):
    request = WINDOWS_INSTALL.createNugetRequest(
      'https://example.test/package.nupkg', {}
    )

    self.assertEqual(request.header_items(), [])

  def test_adds_configured_authentication_headers(self):
    environ = {
      'NODE_RDKAFKA_NUGET_HEADERS': (
        '{"Authorization":"Bearer token","X-Api-Key":"secret"}'
      )
    }

    request = WINDOWS_INSTALL.createNugetRequest(
      'https://example.test/package.nupkg', environ
    )

    self.assertEqual(request.get_header('Authorization'), 'Bearer token')
    self.assertEqual(request.get_header('X-api-key'), 'secret')

  def test_adds_base64_encoded_basic_authentication_header(self):
    credentials = base64.b64encode(b'user:password').decode('ascii')
    authorization = 'Basic ' + credentials
    environ = {
      'NODE_RDKAFKA_NUGET_HEADERS': (
        '{"Authorization":"' + authorization + '"}'
      )
    }

    request = WINDOWS_INSTALL.createNugetRequest(
      'https://example.test/package.nupkg', environ
    )

    self.assertEqual(request.get_header('Authorization'), authorization)

  def test_rejects_non_object_headers(self):
    environ = {'NODE_RDKAFKA_NUGET_HEADERS': '["Authorization"]'}

    with self.assertRaisesRegex(ValueError, 'must be a JSON object'):
      WINDOWS_INSTALL.createNugetRequest(
        'https://example.test/package.nupkg', environ
      )


if __name__ == '__main__':
  unittest.main()
