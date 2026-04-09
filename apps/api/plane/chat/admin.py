# Planer custom: Chat admin
from django.contrib import admin
from plane.chat.models import Channel, ChannelMember, Message, MessageAttachment

admin.site.register(Channel)
admin.site.register(ChannelMember)
admin.site.register(Message)
admin.site.register(MessageAttachment)
