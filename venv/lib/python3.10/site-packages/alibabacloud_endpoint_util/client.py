from Tea.exceptions import RequiredArgumentException


class Client:
    @staticmethod
    def get_endpoint_rules(product, region_id, endpoint_type, network, suffix=None):
        product = product or ""
        network = network or ""
        if endpoint_type == "regional":
            if region_id is None or region_id == "":
                raise RuntimeError(
                    "RegionId is empty, please set a valid RegionId")
            result = "<product><network>.<region_id>.aliyuncs.com".replace(
                "<region_id>", region_id)
        else:
            result = "<product><network>.aliyuncs.com"

        result = result.replace("<product>", product.lower())
        if network == "" or network == "public":
            result = result.replace("<network>", "")
        else:
            result = result.replace("<network>", "-"+network)
        return result
