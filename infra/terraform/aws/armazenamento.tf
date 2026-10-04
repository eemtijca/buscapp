# Bucket privado dos anexos. O acesso acontece pela role da tarefa e por URLs
# pré-assinadas; nunca há leitura pública.

resource "aws_s3_bucket" "anexos" {
  bucket = "${local.nome_base}-anexos-${data.aws_caller_identity.atual.account_id}"

  tags = merge(local.tags, { Name = "${local.nome_base}-anexos" })
}

resource "aws_s3_bucket_ownership_controls" "anexos" {
  bucket = aws_s3_bucket.anexos.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "anexos" {
  bucket = aws_s3_bucket.anexos.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "anexos" {
  bucket = aws_s3_bucket.anexos.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "anexos" {
  bucket = aws_s3_bucket.anexos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "anexos" {
  bucket = aws_s3_bucket.anexos.id

  rule {
    id     = "expirar-versoes-antigas"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  rule {
    id     = "abortar-uploads-incompletos"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# No modo local o driver de disco substitui o S3 e o emulador não recebe CORS.
resource "aws_s3_bucket_cors_configuration" "anexos" {
  count  = var.modo_local ? 0 : 1
  bucket = aws_s3_bucket.anexos.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = [local.url_aplicacao]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
