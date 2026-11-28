import importlib.machinery
import importlib.util
import io
import pathlib
import unittest
from unittest.mock import patch

path = str(pathlib.Path(__file__).parents[1] / 'bin' / 'text')
spec = importlib.util.spec_from_loader('text_cli', importlib.machinery.SourceFileLoader('text_cli', path))
text = importlib.util.module_from_spec(spec)
spec.loader.exec_module(text)

LINES = [{'id': 'PN1', 'name': 'Signage', 'number': '+19362834344'},
         {'id': 'PN2', 'name': 'Bookkeeping Conroe', 'number': '+19362834346'}]


class TextTests(unittest.TestCase):
    def test_numbers_are_normalised(self):
        for raw in ['(281) 435-2299', '281-435-2299', '+1 281 435 2299']:
            self.assertEqual(text.e164(raw), '+12814352299')
        with self.assertRaises(SystemExit):
            text.e164('12345')

    def test_line_by_name_number_or_id(self):
        for wanted in ['signage', '936 283 4344', 'PN1']:
            self.assertEqual(text.choose_line(LINES, wanted)['id'], 'PN1')
        with self.assertRaises(SystemExit):
            text.choose_line(LINES, 'nothing')

    def run_main(self, *extra):
        argv = ['--from', 'signage', '--to', '2814352299', '--body', 'hi', *extra]
        with patch.object(text, 'api_key', return_value='k'), \
             patch.object(text, 'call', side_effect=lambda m, *a: {'data': LINES if m == 'GET' else {'id': 'm1', 'status': 'sent'}}) as call, \
             patch('sys.stdout', new=io.StringIO()):
            try:
                text.main(argv)
            except SystemExit as exit:
                return call, exit.code
            return call, 0

    def test_nothing_is_sent_without_yes(self):
        call, code = self.run_main()
        self.assertEqual(code, 'refusing to send without --yes')
        self.assertTrue(all(c.args[0] == 'GET' for c in call.call_args_list))

    def test_yes_posts_exactly_one_message(self):
        call, code = self.run_main('--yes')
        posts = [c for c in call.call_args_list if c.args[0] == 'POST']
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0].args[3], {'content': 'hi', 'from': 'PN1', 'to': ['+12814352299']})


if __name__ == '__main__':
    unittest.main()
