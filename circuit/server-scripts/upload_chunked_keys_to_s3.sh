BUCKET_NAME=${1:-zk-p2p-onramp}
PARTIAL_ZKEYS_DIR=${2:-./circuit/partial_zkeys}


if [ -d "$PARTIAL_ZKEYS_DIR" ]; then
    echo "Found $PARTIAL_ZKEYS_DIR. Uploading files to $BUCKET_NAME bucket ..."
else
    echo "$PARTIAL_ZKEYS_DIR not found. Exiting..."
    exit 1
fi

cd $PARTIAL_ZKEYS_DIR
aws s3 cp circuit.zkeyb s3://$BUCKET_NAME/circuit.zkeyb
aws s3 cp circuit.zkeyc s3://$BUCKET_NAME/circuit.zkeyc
aws s3 cp circuit.zkeyd s3://$BUCKET_NAME/circuit.zkeyd
aws s3 cp circuit.zkeye s3://$BUCKET_NAME/circuit.zkeye
aws s3 cp circuit.zkeyf s3://$BUCKET_NAME/circuit.zkeyf
aws s3 cp circuit.zkeyg s3://$BUCKET_NAME/circuit.zkeyg
aws s3 cp circuit.zkeyh s3://$BUCKET_NAME/circuit.zkeyh
aws s3 cp circuit.zkeyi s3://$BUCKET_NAME/circuit.zkeyi
aws s3 cp circuit.zkeyj s3://$BUCKET_NAME/circuit.zkeyj
aws s3 cp circuit.zkeyk s3://$BUCKET_NAME/circuit.zkeyk