import { InboxOutlined } from '@ant-design/icons';
import { Upload, message } from 'antd';
import React from 'react';

const { Dragger } = Upload;

interface FileUploadProps {
	onChange?: (file: any | null) => void;
	limit?: number;
	accept?: string;
	value?: any;
}

export default function FileUpload({ accept, limit = 5, onChange, value }: FileUploadProps) {
	const [fileList, setFileList] = React.useState<any[]>(value ? [value] : []);

	React.useEffect(() => {
		setFileList(value ? [value] : []);
	}, [value]);

	return (
		<Dragger
			accept={accept}
			name="file"
			multiple={false}
			onChange={info => {
				const isLimit = info.file.size / 1024 / 1024 < limit;
				if (!isLimit) {
					message.error(`文件大小不能超过 ${limit}MB`);
					return;
				}
				onChange?.(info.file);
			}}
			onRemove={file => {
				setFileList(prevFileList => prevFileList.filter(item => item.uid !== file.uid));
				onChange?.(null);
			}}
			beforeUpload={file => {
				const isLimit = file.size / 1024 / 1024 < limit;
				if (!isLimit) {
					message.error(`文件大小不能超过 ${limit}MB`);
					return Upload.LIST_IGNORE;
				}
				setFileList([file]);
				return false;
			}}
			fileList={fileList}
		>
			<p className="ant-upload-drag-icon">
				<InboxOutlined />
			</p>
			<p className="ant-upload-text">点击或将文件拖到此处上传</p>
			<p className="ant-upload-hint">仅支持上传一个文件，大小不能超过 {limit}MB</p>
		</Dragger>
	);
}
