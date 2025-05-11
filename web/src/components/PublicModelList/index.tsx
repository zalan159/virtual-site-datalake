import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  List, 
  Select, 
  Input, 
  Button, 
  Space, 
  Tag, 
  Pagination, 
  Modal, 
  Form, 
  Upload, 
  message, 
  Spin,
  Tooltip,
  Popconfirm
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  UploadOutlined,
  SearchOutlined,
  DownloadOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { UploadFile } from 'antd/es/upload/interface';
import * as publicModelsAPI from '../../services/publicModels';
import type { PublicModelMetadata } from '../../services/publicModels';

const { Option } = Select;
const { Search } = Input;

interface PublicModelListProps {
  isAdmin: boolean;
}

const PublicModelList: React.FC<PublicModelListProps> = ({ isAdmin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<PublicModelMetadata[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [categories, setCategories] = useState<{[key: string]: string[]}>({});
  const [tags, setTags] = useState<{[key: string]: string[]}>({});
  
  // 筛选条件
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | undefined>();
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  
  // 新增/编辑模型弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增公共模型');
  const [editingModel, setEditingModel] = useState<PublicModelMetadata | null>(null);
  const [form] = Form.useForm();
  const [uploadFile, setUploadFile] = useState<UploadFile | null>(null);
  const [singleUploading, setSingleUploading] = useState(false); // 单个上传状态

  // 批量上传模型弹窗
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [batchUploadFiles, setBatchUploadFiles] = useState<UploadFile[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);

  // 分类和子分类状态管理
  const [categorySubcategoryMap, setCategorySubcategoryMap] = useState<{[key: string]: string[]}>({});
  const [loadingSubcategories, setLoadingSubcategories] = useState<boolean>(false);

  // 加载模型列表
  const loadModels = async () => {
    try {
      setLoading(true);
      const response = await publicModelsAPI.getPublicModels(
        page,
        pageSize,
        selectedCategory,
        selectedSubCategory,
        selectedTag,
        searchText
      );
      setModels(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('加载模型列表失败:', error);
      message.error('加载模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载分类和标签
  const loadCategoriesAndTags = async () => {
    try {
      const categoriesResponse = await publicModelsAPI.getCategories();
      setCategories(categoriesResponse);
      // 缓存分类和子分类映射关系
      setCategorySubcategoryMap(categoriesResponse);

      const tagsResponse = await publicModelsAPI.getTags();
      const processedTags: {[key: string]: string[]} = {};
      
      Object.entries(tagsResponse).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          processedTags[key] = value;
        } else if (typeof value === 'object' && value !== null && 'tags' in value) {
          // @ts-ignore
          processedTags[key] = value.tags;
        }
      });
      
      setTags(processedTags);
    } catch (error) {
      console.error('加载分类和标签失败:', error);
      message.error('加载分类和标签失败');
    }
  };

  // 初始加载
  useEffect(() => {
    loadCategoriesAndTags();
  }, []);

  // 条件变化时重新加载数据
  useEffect(() => {
    loadModels();
  }, [page, pageSize, selectedCategory, selectedSubCategory, selectedTag, searchText]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    setPage(1); // 重置到第一页
  };

  // 处理分类变化
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedSubCategory(undefined); // 重置子分类
    setPage(1);
  };

  // 使用useMemo缓存子分类选项
  const subcategoryOptions = useMemo(() => {
    if (!selectedCategory) return [];
    return (categorySubcategoryMap[selectedCategory] || []).map((subCategory: string) => (
      <Option key={subCategory} value={subCategory}>{subCategory}</Option>
    ));
  }, [selectedCategory, categorySubcategoryMap]);

  // 新增/编辑模型时的分类变化处理
  const handleFormCategoryChange = (value: string, formInstance: any) => {
    formInstance.setFieldsValue({ sub_category: undefined });
  };

  // 处理子分类变化
  const handleSubCategoryChange = (value: string) => {
    setSelectedSubCategory(value);
    setPage(1);
  };

  // 处理标签变化
  const handleTagChange = (value: string) => {
    setSelectedTag(value);
    setPage(1);
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize?: number) => {
    setPage(page);
    if (pageSize) setPageSize(pageSize);
  };

  // 预览模型
  const handlePreview = (modelId: string, hasPreviewImage: boolean) => {
    // 使用window.open在新标签页打开预览
    window.open(`/preview/${modelId}?isPublicModel=true&hasPreviewImage=${hasPreviewImage}`, '_blank');
  };

  // 下载模型
  const handleDownload = async (modelId: string) => {
    try {
      const response = await publicModelsAPI.downloadPublicModel(modelId);
      if (response && response.download_url) {
        // 创建一个临时链接并点击它来触发下载
        const link = document.createElement('a');
        link.href = response.download_url;
        link.target = '_blank';
        link.download = response.filename || 'model';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        message.error('获取下载链接失败');
      }
    } catch (error) {
      console.error('下载模型失败:', error);
      message.error('下载模型失败');
    }
  };

  // 删除模型
  const handleDelete = async (modelId: string) => {
    try {
      await publicModelsAPI.deletePublicModel(modelId);
      message.success('删除成功');
      loadModels(); // 重新加载列表
    } catch (error) {
      console.error('删除模型失败:', error);
      message.error('删除模型失败');
    }
  };

  // 打开新增模型弹窗
  const showAddModal = () => {
    setModalTitle('新增公共模型');
    setEditingModel(null);
    form.resetFields();
    setUploadFile(null);
    setModalVisible(true);
  };

  // 打开编辑模型弹窗
  const showEditModal = (model: PublicModelMetadata) => {
    setModalTitle('编辑公共模型');
    setEditingModel(model);
    form.setFieldsValue({
      filename: model.filename,
      category: model.category,
      sub_category: model.sub_category,
      description: model.description,
      tags: model.tags,
      is_featured: model.is_featured
    });
    setUploadFile(null);
    setModalVisible(true);
  };

  // 处理弹窗确认
  const handleModalOk = () => {
    form.validateFields().then(async (values) => {
      try {
        if (editingModel) {
          // 编辑现有模型
          await publicModelsAPI.updatePublicModel(editingModel._id, {
            ...values,
            is_featured: values.is_featured || false
          });
          message.success('更新成功');
        } else {
          // 新增模型，显示上传中状态
          if (!uploadFile) {
            message.error('请上传模型文件');
            return;
          }
          
          // @ts-ignore - 获取原始文件对象
          const file = uploadFile.originFileObj;
          if (!file) {
            message.error('文件对象无效');
            return;
          }
          
          // 设置上传中状态
          setSingleUploading(true);
          
          // 显示全局提示，避免用户关闭页面
          const uploadingKey = 'uploadingModel';
          message.loading({ content: '模型上传中，请勿关闭页面...', key: uploadingKey, duration: 0 });
          
          try {
            await publicModelsAPI.uploadPublicModel(file, {
              ...values,
              is_featured: values.is_featured || false
            });
            message.success({ content: '上传成功', key: uploadingKey, duration: 2 });
          } catch (error) {
            console.error('上传模型失败:', error);
            message.error({ content: '上传失败', key: uploadingKey, duration: 2 });
            throw error; // 继续抛出错误以便后续捕获
          } finally {
            setSingleUploading(false);
          }
        }
        
        setModalVisible(false);
        loadModels(); // 重新加载列表
      } catch (error) {
        console.error('保存模型失败:', error);
        message.error('保存模型失败');
      }
    });
  };

  // 处理文件上传变化
  const handleFileChange = (info: any) => {
    if (info.fileList.length > 0) {
      setUploadFile(info.fileList[info.fileList.length - 1]);
    } else {
      setUploadFile(null);
    }
  };

  // 打开批量上传弹窗
  const showBatchUploadModal = () => {
    setBatchModalVisible(true);
    batchForm.resetFields();
    setBatchUploadFiles([]);
  };

  // 处理批量文件上传变化
  const handleBatchFileChange = (info: any) => {
    setBatchUploadFiles(info.fileList);
  };

  // 处理批量上传
  const handleBatchUpload = async () => {
    try {
      const values = await batchForm.validateFields();
      
      if (batchUploadFiles.length === 0) {
        message.error('请选择要上传的文件');
        return;
      }
      
      setBatchUploading(true);
      
      // 显示全局提示，避免用户关闭页面
      const uploadingKey = 'batchUploading';
      message.loading({ 
        content: `开始上传${batchUploadFiles.length}个模型，请勿关闭页面...`, 
        key: uploadingKey, 
        duration: 0 
      });
      
      // 添加通用元数据
      const commonMetadata = {
        category: values.category,
        sub_category: values.sub_category,
        description: values.description,
        tags: values.tags || [],
        is_featured: values.is_featured || false
      };
      
      let successCount = 0;
      let failCount = 0;
      let progressCount = 0;
      
      // 依次上传每个文件
      for (const fileInfo of batchUploadFiles) {
        try {
          // @ts-ignore - 获取原始文件对象
          const file = fileInfo.originFileObj;
          if (!file) {
            failCount++;
            continue;
          }
          
          // 更新进度信息
          progressCount++;
          message.loading({ 
            content: `正在上传第 ${progressCount}/${batchUploadFiles.length} 个模型 (${file.name})，请勿关闭页面...`, 
            key: uploadingKey, 
            duration: 0 
          });
          
          // 使用文件原名作为模型名称
          await publicModelsAPI.uploadPublicModel(file, {
            ...commonMetadata,
            filename: file.name
          });
          
          successCount++;
        } catch (error) {
          console.error('上传文件失败:', error);
          failCount++;
        }
      }
      
      if (successCount > 0 && failCount > 0) {
        message.success({ 
          content: `成功上传 ${successCount} 个模型，${failCount} 个模型上传失败`, 
          key: uploadingKey,
          duration: 3
        });
      } else if (successCount > 0) {
        message.success({ 
          content: `成功上传 ${successCount} 个模型`, 
          key: uploadingKey,
          duration: 3
        });
      } else if (failCount > 0) {
        message.error({ 
          content: `${failCount} 个模型上传失败`, 
          key: uploadingKey,
          duration: 3
        });
      }
      
      setBatchModalVisible(false);
      loadModels(); // 重新加载列表
    } catch (error) {
      console.error('批量上传失败:', error);
      message.error('批量上传失败');
    } finally {
      setBatchUploading(false);
    }
  };

  return (
    <div className="public-model-list">
      {/* 筛选区域 */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        <Space wrap>
          {/* 分类筛选 */}
          <Select
            placeholder="选择分类"
            style={{ width: 150 }}
            allowClear
            onChange={handleCategoryChange}
            value={selectedCategory}
          >
            {Object.keys(categories).map(category => (
              <Option key={category} value={category}>{category}</Option>
            ))}
          </Select>
          
          {/* 子分类筛选 */}
          {selectedCategory && (
            <Select
              placeholder="选择子分类"
              style={{ width: 150 }}
              allowClear
              onChange={handleSubCategoryChange}
              value={selectedSubCategory}
              loading={loadingSubcategories}
            >
              {subcategoryOptions}
            </Select>
          )}
          
          {/* 标签筛选 */}
          <Select
            placeholder="选择标签"
            style={{ width: 150 }}
            allowClear
            onChange={handleTagChange}
            value={selectedTag}
          >
            {Object.entries(tags).flatMap(([category, categoryTags]) => 
              categoryTags.map(tag => (
                <Option key={`${category}-${tag}`} value={tag}>
                  {tag}
                </Option>
              ))
            )}
          </Select>
          
          {/* 搜索框 */}
          <Search
            placeholder="搜索模型"
            allowClear
            onSearch={handleSearch}
            style={{ width: 200 }}
          />
          
          {/* 管理员才显示新增按钮和批量上传按钮 */}
          {isAdmin && (
            <>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={showAddModal}
              >
                新增模型
              </Button>
              <Button
                type="primary"
                icon={<InboxOutlined />}
                onClick={showBatchUploadModal}
              >
                批量上传
              </Button>
            </>
          )}
        </Space>
      </Space>
      
      {/* 模型列表 */}
      <Spin spinning={loading}>
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
          dataSource={models}
          renderItem={model => (
            <List.Item>
              <Card
                hoverable
                cover={
                  <div
                    style={{ 
                      height: 200, 
                      backgroundImage: model.preview_image ? `url(${model.preview_image})` : 'none',
                      backgroundColor: !model.preview_image ? '#f0f0f0' : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => handlePreview(model._id, !!model.preview_image)}
                  >
                    {!model.preview_image && (
                      <span style={{ color: '#999' }}>无预览图</span>
                    )}
                  </div>
                }
                actions={[
                  <Tooltip title="预览">
                    <EyeOutlined key="preview" onClick={() => handlePreview(model._id, !!model.preview_image)} />
                  </Tooltip>,
                  <Tooltip title="下载">
                    <DownloadOutlined key="download" onClick={() => handleDownload(model._id)} />
                  </Tooltip>,
                  ...(isAdmin ? [
                    <Tooltip title="编辑">
                      <EditOutlined key="edit" onClick={() => showEditModal(model)} />
                    </Tooltip>,
                    <Tooltip title="删除">
                      <Popconfirm
                        title="确定要删除此模型吗？"
                        onConfirm={() => handleDelete(model._id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <DeleteOutlined key="delete" />
                      </Popconfirm>
                    </Tooltip>
                  ] : [])
                ]}
              >
                <Card.Meta
                  title={model.filename}
                  description={
                    <div>
                      <p>{model.description || '无描述'}</p>
                      <div>
                        <Tag color="blue">{model.category}</Tag>
                        {model.sub_category && (
                          <Tag color="cyan">{model.sub_category}</Tag>
                        )}
                        {model.tags && model.tags.slice(0, 2).map(tag => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                        {model.is_featured && (
                          <Tag color="gold">推荐</Tag>
                        )}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                        下载量: {model.download_count}
                      </div>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
          pagination={false}
        />
        
        {/* 分页 */}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={handlePageChange}
            showSizeChanger
            showQuickJumper
            showTotal={(total) => `共 ${total} 个模型`}
          />
        </div>
      </Spin>
      
      {/* 新增/编辑模型弹窗 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
        confirmLoading={singleUploading}
        maskClosable={!singleUploading} // 上传时不允许点击蒙层关闭
        closable={!singleUploading} // 上传时不显示关闭按钮
        keyboard={!singleUploading} // 上传时禁用ESC关闭
      >
        {singleUploading && (
          <div style={{ marginBottom: 16, textAlign: 'center', color: '#ff4d4f' }}>
            <div>模型上传中，请勿关闭页面！</div>
            <Spin size="large" />
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="filename"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select 
              placeholder="选择或输入分类" 
              onChange={(value) => handleFormCategoryChange(value, form)}
              allowClear
              showSearch
              optionFilterProp="children"
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div style={{ padding: '8px', borderTop: '1px solid #e8e8e8' }}>
                    <Space>
                      <Input
                        placeholder="输入新分类"
                        ref={(input) => {
                          if (input) {
                            input.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value;
                            if (value && Object.keys(categories).every(item => item !== value)) {
                              const newCategories = { ...categories, [value]: [] };
                              const newCategorySubcategoryMap = { ...categorySubcategoryMap, [value]: [] };
                              setCategories(newCategories);
                              setCategorySubcategoryMap(newCategorySubcategoryMap);
                              form.setFieldsValue({ category: value });
                            }
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <span style={{ color: '#999', fontSize: '12px' }}>按Enter添加</span>
                    </Space>
                  </div>
                </div>
              )}
            >
              {Object.keys(categories).map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="sub_category"
            label="子分类"
            dependencies={['category']}
          >
            <Select 
              placeholder="选择或输入子分类" 
              allowClear
              showSearch
              optionFilterProp="children"
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div style={{ padding: '8px', borderTop: '1px solid #e8e8e8' }}>
                    <Space>
                      <Input
                        placeholder="输入新子分类"
                        ref={(input) => {
                          if (input) {
                            input.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value;
                            const category = form.getFieldValue('category');
                            if (value && category) {
                              const subCategories = categorySubcategoryMap[category] || [];
                              if (subCategories.every(item => item !== value)) {
                                const newCategorySubcategoryMap = { 
                                  ...categorySubcategoryMap, 
                                  [category]: [...subCategories, value] 
                                };
                                setCategorySubcategoryMap(newCategorySubcategoryMap);
                                setCategories(newCategorySubcategoryMap);
                                form.setFieldsValue({ sub_category: value });
                              }
                            }
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <span style={{ color: '#999', fontSize: '12px' }}>按Enter添加</span>
                    </Space>
                  </div>
                </div>
              )}
            >
              {(form.getFieldValue('category') && categorySubcategoryMap[form.getFieldValue('category')] || []).map((subCategory: string) => (
                <Option key={subCategory} value={subCategory}>{subCategory}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          
          <Form.Item
            name="tags"
            label="标签"
          >
            <Select mode="tags" placeholder="输入或选择标签">
              {Object.entries(tags).flatMap(([category, categoryTags]) => 
                categoryTags.map(tag => (
                  <Option key={`${category}-${tag}`} value={tag}>
                    {tag}
                  </Option>
                ))
              )}
            </Select>
          </Form.Item>
          
          {isAdmin && (
            <Form.Item
              name="is_featured"
              valuePropName="checked"
              label="推荐模型"
            >
              <Select
                placeholder="是否推荐"
                options={[
                  { value: true, label: '是' },
                  { value: false, label: '否' }
                ]}
              />
            </Form.Item>
          )}
          
          {!editingModel && (
            <Form.Item
              label="上传模型文件"
              required
            >
              <Upload
                maxCount={1}
                beforeUpload={() => false} // 阻止自动上传
                onChange={handleFileChange}
                fileList={uploadFile ? [uploadFile] : []}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 批量上传模型弹窗 */}
      <Modal
        title="批量上传模型"
        open={batchModalVisible}
        onOk={handleBatchUpload}
        onCancel={() => setBatchModalVisible(false)}
        width={600}
        confirmLoading={batchUploading}
        maskClosable={!batchUploading} // 上传时不允许点击蒙层关闭
        closable={!batchUploading} // 上传时不显示关闭按钮
        keyboard={!batchUploading} // 上传时禁用ESC关闭
      >
        {batchUploading && (
          <div style={{ marginBottom: 16, textAlign: 'center', color: '#ff4d4f' }}>
            <div>批量上传中，请勿关闭页面！</div>
            <Spin size="large" />
          </div>
        )}
        <Form
          form={batchForm}
          layout="vertical"
        >
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select 
              placeholder="选择或输入分类" 
              onChange={(value) => handleFormCategoryChange(value, batchForm)}
              allowClear
              showSearch
              optionFilterProp="children"
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div style={{ padding: '8px', borderTop: '1px solid #e8e8e8' }}>
                    <Space>
                      <Input
                        placeholder="输入新分类"
                        ref={(input) => {
                          if (input) {
                            input.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value;
                            if (value && Object.keys(categories).every(item => item !== value)) {
                              const newCategories = { ...categories, [value]: [] };
                              const newCategorySubcategoryMap = { ...categorySubcategoryMap, [value]: [] };
                              setCategories(newCategories);
                              setCategorySubcategoryMap(newCategorySubcategoryMap);
                              batchForm.setFieldsValue({ category: value });
                            }
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <span style={{ color: '#999', fontSize: '12px' }}>按Enter添加</span>
                    </Space>
                  </div>
                </div>
              )}
            >
              {Object.keys(categories).map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="sub_category"
            label="子分类"
            dependencies={['category']}
          >
            <Select 
              placeholder="选择或输入子分类" 
              allowClear
              showSearch
              optionFilterProp="children"
              dropdownRender={(menu) => (
                <div>
                  {menu}
                  <div style={{ padding: '8px', borderTop: '1px solid #e8e8e8' }}>
                    <Space>
                      <Input
                        placeholder="输入新子分类"
                        ref={(input) => {
                          if (input) {
                            input.focus();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value;
                            const category = batchForm.getFieldValue('category');
                            if (value && category) {
                              const subCategories = categorySubcategoryMap[category] || [];
                              if (subCategories.every(item => item !== value)) {
                                const newCategorySubcategoryMap = { 
                                  ...categorySubcategoryMap, 
                                  [category]: [...subCategories, value] 
                                };
                                setCategorySubcategoryMap(newCategorySubcategoryMap);
                                setCategories(newCategorySubcategoryMap);
                                batchForm.setFieldsValue({ sub_category: value });
                              }
                            }
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <span style={{ color: '#999', fontSize: '12px' }}>按Enter添加</span>
                    </Space>
                  </div>
                </div>
              )}
            >
              {(batchForm.getFieldValue('category') && categorySubcategoryMap[batchForm.getFieldValue('category')] || []).map((subCategory: string) => (
                <Option key={subCategory} value={subCategory}>{subCategory}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="description"
            label="公共描述"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          
          <Form.Item
            name="tags"
            label="标签"
          >
            <Select mode="tags" placeholder="输入或选择标签">
              {Object.entries(tags).flatMap(([category, categoryTags]) => 
                categoryTags.map(tag => (
                  <Option key={`${category}-${tag}`} value={tag}>
                    {tag}
                  </Option>
                ))
              )}
            </Select>
          </Form.Item>
          
          {isAdmin && (
            <Form.Item
              name="is_featured"
              valuePropName="checked"
              label="推荐模型"
            >
              <Select
                placeholder="是否推荐"
                options={[
                  { value: true, label: '是' },
                  { value: false, label: '否' }
                ]}
              />
            </Form.Item>
          )}
          
          <Form.Item
            label="上传模型文件"
            required
          >
            <Upload.Dragger
              multiple
              beforeUpload={() => false} // 阻止自动上传
              onChange={handleBatchFileChange}
              fileList={batchUploadFiles}
              accept=".glb"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">支持批量上传多个GLB文件，文件名将作为模型名称</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PublicModelList; 