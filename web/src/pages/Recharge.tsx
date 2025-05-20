import React, { useState } from "react";
import { Card, Button, Space, message } from "antd";
import { paymentAPI } from "../services/api";

const amounts = [50, 100, 200, 500];

const Recharge: React.FC = () => {
  const [loadingId, setLoadingId] = useState<string>("");

  const handleRecharge = async (amount: number) => {
    try {
      setLoadingId(String(amount));
      const res = await paymentAPI.createRecharge(amount);
      const { order_id, pay_url } = res.data;
      // 打开支付链接，新窗口
      window.open(pay_url, "_blank");
      await paymentAPI.confirmRecharge(order_id);
      message.success("充值成功");
    } catch (err) {
      message.error("充值失败");
    } finally {
      setLoadingId("");
    }
  };

  return (
    <Card title="账户充值">
      <Space>
        {amounts.map((a) => (
          <Button
            key={a}
            type="primary"
            loading={loadingId === String(a)}
            onClick={() => handleRecharge(a)}
          >
            充值 {a} 元
          </Button>
        ))}
      </Space>
    </Card>
  );
};

export default Recharge;
