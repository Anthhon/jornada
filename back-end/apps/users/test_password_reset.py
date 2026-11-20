from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    FRONTEND_URL='http://localhost:3000',
)
class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user('professor', email='professor@example.com', password='Old-access!5629')
        self.uid = urlsafe_base64_encode(force_bytes(self.user.pk))

    def confirm(self, token, password='New-adventure!7284', uid=None):
        return self.client.post('/api/password-reset/confirm/', {
            'uid': self.uid if uid is None else uid,
            'token': token,
            'new_password': password,
        }, format='json')

    def test_email_contains_frontend_link_and_unknown_email_has_same_response(self):
        response = self.client.post('/api/password-reset/', {'email': self.user.email}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f'http://localhost:3000/reset-password/{self.uid}/', mail.outbox[0].body)
        unknown = self.client.post('/api/password-reset/', {'email': 'unknown@example.com'}, format='json')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.data, response.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_password_changes_and_token_cannot_be_reused(self):
        token = default_token_generator.make_token(self.user)
        self.assertEqual(self.confirm(token).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('New-adventure!7284'))
        self.assertFalse(self.user.check_password('Old-access!5629'))
        reused = self.confirm(token)
        self.assertEqual(reused.status_code, 400)
        self.assertEqual(reused.data['code'], 'invalid_token')

    def test_weak_password_is_rejected_without_consuming_link(self):
        token = default_token_generator.make_token(self.user)
        response = self.confirm(token, password='12345678')
        self.assertEqual(response.status_code, 400)
        self.assertIn('new_password', response.data)
        self.assertEqual(self.confirm(token).status_code, 200)

    def test_expired_and_malformed_links_are_rejected(self):
        token = default_token_generator.make_token(self.user)
        future = default_token_generator._now() + timedelta(hours=2)
        with patch.object(default_token_generator, '_now', return_value=future):
            self.assertEqual(self.confirm(token).data['code'], 'invalid_token')
        self.assertEqual(self.confirm(token, uid='invalid-user').status_code, 400)

    def test_inactive_account_cannot_reset_password(self):
        token = default_token_generator.make_token(self.user)
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.client.post('/api/password-reset/', {'email': self.user.email}, format='json')
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(self.confirm(token).data['code'], 'invalid_token')

    def test_request_is_rate_limited(self):
        for _ in range(5):
            self.assertEqual(self.client.post('/api/password-reset/', {'email': 'unknown@example.com'}, format='json').status_code, 200)
        self.assertEqual(self.client.post('/api/password-reset/', {'email': 'unknown@example.com'}, format='json').status_code, 429)
