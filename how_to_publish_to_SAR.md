# How to

* https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-template-publishing-applications.html

# Prerequisite

* SAM CLI installed
* single stack

# deploy

    cdk synth
    sam validate -t cdk.out/PublishedAuthenticatedStaticSiteStack.template.json 
    sam publish -t cdk.out/PublishedAuthenticatedStaticSiteStack.template.json --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE
