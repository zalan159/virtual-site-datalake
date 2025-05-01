import { modelAPI } from '../services/modelApi';
import { message } from 'antd';

const handleDownload = async (fileId: string) => {
  try {
    // 获取预签名URL
    const downloadUrl = await modelAPI.getModelDownloadUrl(fileId);
    // 使用预签名URL直接下载
    window.open(downloadUrl, '_blank');
  } catch (error) {
    message.error('下载失败，请重试');
  }
};

const handleDownloadConverted = async (fileId: string) => {
  try {
    // 获取预签名URL
    const downloadUrl = await modelAPI.getConvertedModelDownloadUrl(fileId);
    // 使用预签名URL直接下载
    window.open(downloadUrl, '_blank');
  } catch (error) {
    message.error('下载失败，请重试');
  }
}; 