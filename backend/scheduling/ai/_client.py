"""AWS Bedrock client factory."""

import boto3
from django.conf import settings


def make_client():
    return boto3.client("bedrock-runtime", region_name=settings.AWS_REGION)
