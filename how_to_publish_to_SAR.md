# How to

- https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-template-publishing-applications.html

# Prerequisite

- SAM CLI installed
- single stack

# deploy

    cdk synth --version-reporting false > template.yaml
    sam validate
    sam package --region $AWS_DEFAULT_REGION --resolve-s3 --output-template-file packaged.yaml --profile $AWS_PROFILE
    sam publish -t packaged.yaml --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE
