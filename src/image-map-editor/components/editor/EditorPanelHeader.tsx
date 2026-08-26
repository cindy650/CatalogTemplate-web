import { Typography } from 'antd';
import React from 'react';

interface EditorPanelHeaderProps {
	title: React.ReactNode;
	description?: React.ReactNode;
	eyebrow?: React.ReactNode;
	action?: React.ReactNode;
}

export default function EditorPanelHeader({ action, description, eyebrow, title }: EditorPanelHeaderProps) {
	return (
		<header className="rde-editor-panel-header">
			<div className="rde-editor-panel-header-copy">
				{eyebrow ? <Typography.Text className="rde-editor-panel-eyebrow">{eyebrow}</Typography.Text> : null}
				<Typography.Text strong className="rde-editor-panel-title">{title}</Typography.Text>
				{description ? <Typography.Text type="secondary" className="rde-editor-panel-description">{description}</Typography.Text> : null}
			</div>
			{action ? <div className="rde-editor-panel-header-action">{action}</div> : null}
		</header>
	);
}
