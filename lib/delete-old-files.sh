#!/bin/bash -e

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "ERROR: Environment variable S3_BUCKET_NAME is not set"
    exit 1
fi
echo "Will clean up S3 bucket: ${S3_BUCKET_NAME}"

# Because we use an associative array we need Bash 4 or higher
if [ -z "${BASH_VERSINFO}" ]; then
    echo "ERROR: Bash version 4 or higher is needed to run this script. You are not running bash."
    exit 1
elif [ "${BASH_VERSINFO:-0}" -lt 4 ]; then
    echo "ERROR: Bash version 4 or higher is needed to run this script. You are running: ${BASH_VERSINFO}"
    exit 1
fi
echo "Running bash version: ${BASH_VERSINFO}"

# Build Hash map of current files
declare -A NEW_FILES
for ENTRY in $(find . -type f); do
    NEW_FILES["${ENTRY}"]="${ENTRY}"
done
echo "Files locally: ${!NEW_FILES[@]}"

# Get list of S3 files
S3_FILES=$(aws s3 ls "s3://${S3_BUCKET_NAME}" --recursive | awk '{print $4}' | tr '\n' ' ')
echo "Files on S3: ${S3_FILES}"

# Loop through files on S3 and delete ones we don't have locally
for KEY in $S3_FILES; do
    if [ -z "${NEW_FILES["./${KEY}"]}" ]; then
        echo "S3 file does not exist locally: ./${KEY}"
        aws s3 rm "s3://${S3_BUCKET_NAME}/${KEY}"
    fi
done
