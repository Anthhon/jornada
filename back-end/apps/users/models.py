from django.contrib.auth.models import User
from django.db import models

# Define the Profile object to be linked to a User
class Profile(models.Model):
    created_at = models.DateTimeField(auto_now_add = True)
    updated_at = models.DateTimeField(auto_now = True)
    user = models.OneToOneField(
            User,
            related_name='profile',
            on_delete=models.CASCADE,
            )

    def __str__(self):
        return self.user.username
